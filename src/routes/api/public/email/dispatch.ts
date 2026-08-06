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
        const { authorizeDispatch, readStagingLeadPlanId } =
          await import("@/lib/email/dispatch-auth");
        const mode = authorizeDispatch(request);
        if (!mode) return unauthorized();

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

        const { buildDispatchDeps } = await import("@/lib/email/runtime.server");
        const runtime = await buildDispatchDeps();

        if (!runtime.enabled) {
          // Fail-closed: no provider attempt while prerequisites are missing.
          return Response.json(
            { sending_enabled: false, missing_configuration: runtime.missing, claimed: 0 },
            { status: 200 },
          );
        }

        const {
          dispatchPlanReadyJobs,
          dispatchRecoveryJobs,
          dispatchPlanCompletedJobs,
          dispatchHalfwayJobs,
          dispatchStalledJobs,
          dispatchStartDayOneJobs,
          dispatchFinalRescueJobs,
          raiseStalePlanReadyAlerts,
        } = await import("@/lib/email/dispatch");
        const summary = await dispatchPlanReadyJobs(runtime.deps, { limit: 25 });
        const staleAlerts = await raiseStalePlanReadyAlerts(runtime.deps);

        // Recovery runs after Plan Ready and before proactive lifecycle dispatch.
        // This is execution ordering only: recovery is on-demand product access,
        // holds no lifecycle priority, consumes no shared 24-hour lifecycle gap,
        // counts toward no inactivity cap, and never cancels, defers, or
        // reprioritizes any proactive lifecycle job.
        const recovery = await dispatchRecoveryJobs(runtime.deps, { limit: 25 });

        // Lifecycle priority, in exact order: Plan Completed, then Halfway, then
        // Final Rescue, then Stalled, then Start Day 1. Higher priority runs
        // first in the tick so it consumes the shared 24-hour lifecycle gap
        // before any lower-priority message.
        const { loadPlanCompletedState } = await import("@/lib/email/plan-completed-state.server");
        const planCompleted = await dispatchPlanCompletedJobs(
          { ...runtime.deps, loadPlanCompletedState: (job) => loadPlanCompletedState(job) },
          { limit: 25 },
        );

        const { loadHalfwayState } = await import("@/lib/email/halfway-state.server");
        const halfway = await dispatchHalfwayJobs(
          { ...runtime.deps, loadHalfwayState: (job) => loadHalfwayState(job) },
          { limit: 25 },
        );

        // Final Rescue is terminal but outranks the two lower inactivity
        // messages: a due Final Rescue closes Stalled and Start Day 1.
        const { loadFinalRescueState } = await import("@/lib/email/final-rescue-state.server");
        const finalRescue = await dispatchFinalRescueJobs(
          { ...runtime.deps, loadFinalRescueState: (job) => loadFinalRescueState(job) },
          { limit: 25 },
        );

        const { loadStalledState } = await import("@/lib/email/stalled-state.server");
        const stalled = await dispatchStalledJobs(
          { ...runtime.deps, loadStalledState: (job) => loadStalledState(job) },
          { limit: 25 },
        );

        // Start Day 1 shares the runtime, store, lease claim, and adapter. Its
        // authoritative read-only state loader is injected here.
        const { loadStartDayOneState } = await import("@/lib/email/start-day-1-state.server");
        const startDayOne = await dispatchStartDayOneJobs(
          { ...runtime.deps, loadStartDayOneState: (job) => loadStartDayOneState(job) },
          { limit: 25 },
        );

        return Response.json({
          sending_enabled: true,
          ...summary,
          stale_alerts: staleAlerts,
          recovery,
          plan_completed: planCompleted,
          halfway,
          stalled,
          start_day_1: startDayOne,
          final_rescue: finalRescue,
        });
      },
    },
  },
});
