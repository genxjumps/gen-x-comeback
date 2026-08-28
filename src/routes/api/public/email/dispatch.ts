// Durable outbox worker endpoint. Called by a scheduler (pg_cron via pg_net)
// or manually. No provider call ever happens inside the plan transaction.
//
// Authorization is a dedicated server-only shared secret, presented ONLY as
// `Authorization: Bearer <secret>`. Supabase anon/publishable keys are never
// accepted, and the `apikey` header is ignored entirely.
//
// A strictly staging-only second mode exists for fake-provider acceptance runs.
// It requires BOTH a server environment flag and a separate staging secret, and
// it can only ever touch one explicitly supplied synthetic lead plan.
import { createFileRoute } from "@tanstack/react-router";

function unauthorized(): Response {
  return new Response("unauthorized", {
    status: 401,
    headers: { "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/email/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeStagingDispatch, readStagingLeadPlanId } =
          await import("@/lib/email/dispatch-auth");
        const mode = authorizeStagingDispatch(request);

        if (mode === "real_staging") {
          // Exactly one required lead_plan_id, validated before any claim.
          const leadPlanId = await readStagingLeadPlanId(request);
          if (!leadPlanId) {
            return Response.json(
              { mode: "real_staging", sending_enabled: false, error: "invalid_lead_plan_id" },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }

          const { buildRealStagingDispatchDeps } =
            await import("@/lib/email/real-staging-runtime.server");
          const real = await buildRealStagingDispatchDeps(leadPlanId);
          if (!real.ok) {
            // Fail-closed before any provider request exists.
            return Response.json(
              {
                mode: "real_staging",
                sending_enabled: false,
                lead_plan_id: leadPlanId,
                error: real.error,
                ...(real.error === "missing_configuration"
                  ? { missing_configuration: real.missing }
                  : {}),
                claimed: 0,
              },
              { status: real.error === "recipient_not_allowed" ? 403 : 200 },
            );
          }

          // Same dispatcher functions and same lifecycle ordering as production,
          // but lead-scoped and without the global stale-Plan-Ready sweep.
          const { runDispatchCycle } = await import("@/lib/email/dispatch-cycle.server");
          const cycle = await runDispatchCycle(real.deps, { limit: 25 });
          const evidence = real.evidence();

          return Response.json(
            {
              mode: "real_staging",
              // Production sending remains gated and unchanged.
              sending_enabled: false,
              lead_plan_id: leadPlanId,
              ...cycle.planReady,
              stale_alerts: 0,
              recovery: cycle.recovery,
              plan_completed: cycle.planCompleted,
              halfway: cycle.halfway,
              stalled: cycle.stalled,
              start_day_1: cycle.startDayOne,
              final_rescue: cycle.finalRescue,
              // Non-secret provider evidence only.
              provider_key: evidence?.providerKey ?? null,
              provider_message_id: evidence?.providerMessageId ?? null,
            },
            { headers: { "cache-control": "no-store" } },
          );
        }

        if (mode === "fake_staging") {
          // Exactly one required synthetic lead_plan_id, validated before any claim.
          const leadPlanId = await readStagingLeadPlanId(request);
          if (!leadPlanId) {
            return Response.json(
              { mode: "fake_staging", sending_enabled: false, error: "invalid_lead_plan_id" },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }

          const { buildFakeStagingDispatchDeps } =
            await import("@/lib/email/staging-runtime.server");
          const staging = await buildFakeStagingDispatchDeps(leadPlanId);
          if (!staging.enabled) {
            // Fail-closed: link rendering/derivation configuration is required.
            return Response.json(
              {
                mode: "fake_staging",
                sending_enabled: false,
                missing_configuration: staging.missing,
                claimed: 0,
              },
              { status: 200, headers: { "cache-control": "no-store" } },
            );
          }

          // Same dispatcher functions and same lifecycle ordering as production,
          // but lead-scoped and with the global stale-Plan-Ready alert sweep
          // deliberately skipped: that sweep is not lead-scoped.
          const { runDispatchCycle } = await import("@/lib/email/dispatch-cycle.server");
          const cycle = await runDispatchCycle(staging.deps, { limit: 25 });

          return Response.json(
            {
              mode: "fake_staging",
              sending_enabled: false,
              lead_plan_id: leadPlanId,
              ...cycle.planReady,
              stale_alerts: 0,
              recovery: cycle.recovery,
              plan_completed: cycle.planCompleted,
              halfway: cycle.halfway,
              stalled: cycle.stalled,
              start_day_1: cycle.startDayOne,
              final_rescue: cycle.finalRescue,
            },
            { headers: { "cache-control": "no-store" } },
          );
        }

        const {
          authenticateProductionScheduler,
          countProductionEligibleJobs,
          finishSchedulerInvocation,
          readProductionDispatchGate,
        } = await import("@/lib/email/production-scheduler.server");
        const authentication = await authenticateProductionScheduler(request);
        if (!authentication.ok) return unauthorized();

        // MailerLite contact sync shares the already-authenticated five-minute
        // scheduler tick, but has a separate fail-closed environment gate. A
        // MailerLite failure never blocks or enables Resend lifecycle delivery.
        let marketingSync: Record<string, unknown>;
        try {
          const { runProductionMarketingSync } = await import("@/lib/marketing/runtime.server");
          marketingSync = await runProductionMarketingSync();
        } catch {
          marketingSync = { enabled: true, error: "dispatch_failed" };
        }

        const gate = await readProductionDispatchGate();
        if (!gate.enabled) {
          await finishSchedulerInvocation({
            invocationId: authentication.invocationId,
            succeeded: true,
            sendingEnabled: false,
            claimedCount: 0,
            eligibleJobsAfter: 0,
            failureCode: gate.reason,
          });
          return Response.json(
            {
              mode: "production",
              sending_enabled: false,
              activation_boundary: gate.activationBoundary,
              claimed: 0,
              provider_submissions: 0,
              marketing_sync: marketingSync,
            },
            { headers: { "cache-control": "no-store" } },
          );
        }

        const { buildDispatchDeps } = await import("@/lib/email/runtime.server");
        const runtime = await buildDispatchDeps(authentication.invocationId);

        if (!runtime.enabled) {
          // Fail-closed: no provider attempt while prerequisites are missing.
          await finishSchedulerInvocation({
            invocationId: authentication.invocationId,
            succeeded: false,
            sendingEnabled: true,
            claimedCount: 0,
            eligibleJobsAfter: await countProductionEligibleJobs(),
            failureCode: "missing_runtime_configuration",
          });
          return Response.json(
            {
              mode: "production",
              sending_enabled: false,
              missing_configuration: runtime.missing,
              claimed: 0,
              provider_submissions: 0,
              marketing_sync: marketingSync,
            },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        }

        try {
          const { runDispatchCycle } = await import("@/lib/email/dispatch-cycle.server");
          const cycle = await runDispatchCycle(runtime.deps, {
            limit: gate.providerSubmissionLimit,
            staleAlerts: true,
          });
          const summaries = [
            cycle.planReady,
            cycle.recovery,
            cycle.planCompleted,
            cycle.halfway,
            cycle.finalRescue,
            cycle.stalled,
            cycle.startDayOne,
          ];
          const claimed = summaries.reduce((sum, value) => sum + value.claimed, 0);
          const providerSubmissions = summaries.reduce(
            (sum, value) =>
              sum +
              value.outcomes.filter((outcome) => outcome.outcome === "provider_accepted").length,
            0,
          );
          const eligibleJobsAfter = await countProductionEligibleJobs();
          await finishSchedulerInvocation({
            invocationId: authentication.invocationId,
            succeeded: true,
            sendingEnabled: true,
            claimedCount: claimed,
            eligibleJobsAfter,
          });
          return Response.json(
            {
              mode: "production",
              sending_enabled: true,
              activation_boundary: gate.activationBoundary,
              provider_submission_limit: gate.providerSubmissionLimit,
              provider_submissions: providerSubmissions,
              marketing_sync: marketingSync,
              ...cycle.planReady,
              claimed,
              stale_alerts: cycle.staleAlerts,
              recovery: cycle.recovery,
              plan_completed: cycle.planCompleted,
              halfway: cycle.halfway,
              stalled: cycle.stalled,
              start_day_1: cycle.startDayOne,
              final_rescue: cycle.finalRescue,
            },
            { headers: { "cache-control": "no-store" } },
          );
        } catch {
          const { disableProductionSending } =
            await import("@/lib/email/production-scheduler.server");
          try {
            await disableProductionSending("dispatch_exception");
          } catch {
            // The response remains a failure. Operational evidence already
            // records any completed provider reservation, and no retry occurs
            // inside this invocation.
          }
          try {
            await finishSchedulerInvocation({
              invocationId: authentication.invocationId,
              succeeded: false,
              sendingEnabled: false,
              claimedCount: 0,
              eligibleJobsAfter: await countProductionEligibleJobs(),
              failureCode: "dispatch_exception_send_gate_disabled",
            });
          } catch {
            // Fail closed even if invocation finalization is unavailable.
          }
          return Response.json(
            { mode: "production", sending_enabled: false, error: "dispatch_failed" },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
