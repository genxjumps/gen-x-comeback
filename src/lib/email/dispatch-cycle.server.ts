// Shared dispatch execution cycle. Server-only.
//
// One place owns the lifecycle ordering so production and the staging
// fake-provider mode can never drift apart:
// Plan Ready, Recovery, Plan Completed, Halfway, Final Rescue, Stalled,
// Start Day 1.
import type { DispatchDeps, DispatchSummary } from "@/lib/email/dispatch";

export type DispatchCycleResult = {
  planReady: DispatchSummary;
  recovery: DispatchSummary;
  planCompleted: DispatchSummary;
  halfway: DispatchSummary;
  finalRescue: DispatchSummary;
  stalled: DispatchSummary;
  startDayOne: DispatchSummary;
};

export async function runDispatchCycle(
  deps: DispatchDeps,
  options?: { limit?: number },
): Promise<DispatchCycleResult> {
  const limit = options?.limit ?? 25;

  const {
    dispatchPlanReadyJobs,
    dispatchRecoveryJobs,
    dispatchPlanCompletedJobs,
    dispatchHalfwayJobs,
    dispatchStalledJobs,
    dispatchStartDayOneJobs,
    dispatchFinalRescueJobs,
  } = await import("@/lib/email/dispatch");

  const planReady = await dispatchPlanReadyJobs(deps, { limit });

  // Recovery runs after Plan Ready and before proactive lifecycle dispatch.
  // This is execution ordering only: recovery is on-demand product access,
  // holds no lifecycle priority, consumes no shared 24-hour lifecycle gap,
  // counts toward no inactivity cap, and never cancels, defers, or
  // reprioritizes any proactive lifecycle job.
  const recovery = await dispatchRecoveryJobs(deps, { limit });

  // Lifecycle priority, in exact order: Plan Completed, then Halfway, then
  // Final Rescue, then Stalled, then Start Day 1. Higher priority runs
  // first in the tick so it consumes the shared 24-hour lifecycle gap
  // before any lower-priority message.
  const { loadPlanCompletedState } = await import("@/lib/email/plan-completed-state.server");
  const planCompleted = await dispatchPlanCompletedJobs(
    { ...deps, loadPlanCompletedState: (job) => loadPlanCompletedState(job) },
    { limit },
  );

  const { loadHalfwayState } = await import("@/lib/email/halfway-state.server");
  const halfway = await dispatchHalfwayJobs(
    { ...deps, loadHalfwayState: (job) => loadHalfwayState(job) },
    { limit },
  );

  // Final Rescue is terminal but outranks the two lower inactivity
  // messages: a due Final Rescue closes Stalled and Start Day 1.
  const { loadFinalRescueState } = await import("@/lib/email/final-rescue-state.server");
  const finalRescue = await dispatchFinalRescueJobs(
    { ...deps, loadFinalRescueState: (job) => loadFinalRescueState(job) },
    { limit },
  );

  const { loadStalledState } = await import("@/lib/email/stalled-state.server");
  const stalled = await dispatchStalledJobs(
    { ...deps, loadStalledState: (job) => loadStalledState(job) },
    { limit },
  );

  // Start Day 1 shares the runtime, store, lease claim, and adapter. Its
  // authoritative read-only state loader is injected here.
  const { loadStartDayOneState } = await import("@/lib/email/start-day-1-state.server");
  const startDayOne = await dispatchStartDayOneJobs(
    { ...deps, loadStartDayOneState: (job) => loadStartDayOneState(job) },
    { limit },
  );

  return { planReady, recovery, planCompleted, halfway, finalRescue, stalled, startDayOne };
}
