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
        const { authorizeDispatch, readStagingLeadPlanId } = await import(
          "@/lib/email/dispatch-auth"
        );
        const mode = authorizeDispatch(request);
        if (!mode) return unauthorized();

        const { runDispatchCycle } = await import("@/lib/email/dispatch-cycle.server");

        if (mode === "fake_staging") {
          // Exactly one required synthetic lead_plan_id, validated before any claim.
          const leadPlanId = await readStagingLeadPlanId(request);
          if (!leadPlanId) {
            return Response.json(
              { mode: "fake_staging", sending_enabled: false, error: "invalid_lead_plan_id" },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }

          const { buildFakeStagingDispatchDeps } = await import(
            "@/lib/email/staging-runtime.server"
          );
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

          // No global stale-Plan-Ready alert sweep here: that sweep is not
          // lead-scoped, so staging must never run it.
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

        const { buildDispatchDeps } = await import("@/lib/email/runtime.server");
        const runtime = await buildDispatchDeps();

        if (!runtime.enabled) {
          // Fail-closed: no provider attempt while prerequisites are missing.
          return Response.json(
            { sending_enabled: false, missing_configuration: runtime.missing, claimed: 0 },
            { status: 200 },
          );
        }

        const cycle = await runDispatchCycle(runtime.deps, { limit: 25, staleAlerts: true });

        return Response.json({
          sending_enabled: true,
          ...cycle.planReady,
          stale_alerts: cycle.staleAlerts,
          recovery: cycle.recovery,
          plan_completed: cycle.planCompleted,
          halfway: cycle.halfway,
          stalled: cycle.stalled,
          start_day_1: cycle.startDayOne,
          final_rescue: cycle.finalRescue,
        });
      },
    },
  },
});
