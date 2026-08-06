// Durable outbox worker endpoint. Called by a scheduler (pg_cron via pg_net)
// or manually. No provider call ever happens inside the plan transaction.
//
// Authorization is a dedicated server-only shared secret, presented ONLY as
// `Authorization: Bearer <secret>`. Supabase anon/publishable keys are never
// accepted, and the `apikey` header is ignored entirely.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

function unauthorized(): Response {
  return new Response("unauthorized", {
    status: 401,
    headers: { "cache-control": "no-store" },
  });
}

/** Constant-time compare over equal-length digests (raw lengths never leak). */
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function authorize(request: Request): boolean {
  const expected = process.env["EMAIL_DISPATCH_SECRET"];
  if (typeof expected !== "string" || expected.trim().length === 0) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const match = /^Bearer[ ]+(.+)$/.exec(header.trim());
  if (!match) return false;

  const provided = match[1]!.trim();
  if (provided.length === 0) return false;

  return secretsMatch(provided, expected.trim());
}

export const Route = createFileRoute("/api/public/email/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorize(request)) return unauthorized();

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
