// Shared dispatch execution cycle. Server-only.
//
// One place owns the lifecycle ordering so production and the staging
// fake-provider mode can never drift apart:
// Plan Ready, Recovery, Plan Completed, Halfway, Final Rescue, Stalled,
// Start Day 1.
import type { DispatchDeps, DispatchSummary } from "@/lib/email/dispatch";
import { prepareEmail, type QueueRunner } from "@/lib/email/queue-isolation";

export type DispatchCycleResult = {
  planReady: DispatchSummary;
  recovery: DispatchSummary;
  planCompleted: DispatchSummary;
  halfway: DispatchSummary;
  finalRescue: DispatchSummary;
  stalled: DispatchSummary;
  startDayOne: DispatchSummary;
  /** 0 unless the global (non-lead-scoped) sweep was explicitly requested. */
  staleAlerts: number;
};

export async function runDispatchCycle(
  deps: DispatchDeps,
  options?: { limit?: number; staleAlerts?: boolean; runQueue?: QueueRunner },
): Promise<DispatchCycleResult> {
  const limit = options?.limit ?? 25;
  const run: QueueRunner = options?.runQueue ?? (async (_name, work) => work());
  const empty: DispatchSummary = { claimed: 0, outcomes: [] };
  let proactiveBlocked = false;
  async function lifecycle(name: string, work: () => Promise<DispatchSummary>) {
    if (proactiveBlocked) return empty;
    let completed = false;
    const result = await run(
      name,
      async () => {
        const value = await work();
        completed = true;
        return value;
      },
      empty,
    );
    // Preserve lifecycle priority when a higher-priority resolver couldn't finish.
    if (!completed) proactiveBlocked = true;
    return result;
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

  const planReady = await run("plan_ready", () => dispatchPlanReadyJobs(deps, { limit }), empty);

  // The stale-Plan-Ready sweep is global, not lead-scoped, so it runs only when
  // the caller opts in (production). Its position in the tick is unchanged.
  const staleAlerts = options?.staleAlerts
    ? await run(
        "stale_alerts",
        () => prepareEmail("stale_alerts", () => raiseStalePlanReadyAlerts(deps)),
        0,
      )
    : 0;

  // Recovery runs after Plan Ready and before proactive lifecycle dispatch.
  // This is execution ordering only: recovery is on-demand product access,
  // holds no lifecycle priority, consumes no shared 24-hour lifecycle gap,
  // counts toward no inactivity cap, and never cancels, defers, or
  // reprioritizes any proactive lifecycle job.
  const recovery = await run("recovery", () => dispatchRecoveryJobs(deps, { limit }), empty);

  // Lifecycle priority, in exact order: Plan Completed, then Halfway, then
  // Final Rescue, then Stalled, then Start Day 1. Higher priority runs
  // first in the tick so it consumes the shared 24-hour lifecycle gap
  // before any lower-priority message.
  const { loadPlanCompletedState } = await import("@/lib/email/plan-completed-state.server");
  const planCompleted = await lifecycle("plan_completed", () =>
    dispatchPlanCompletedJobs(
      {
        ...deps,
        loadPlanCompletedState: (job) =>
          prepareEmail("plan_completed_state", () => loadPlanCompletedState(job)),
      },
      { limit },
    ),
  );

  const { loadHalfwayState } = await import("@/lib/email/halfway-state.server");
  const halfway = await lifecycle("halfway", () =>
    dispatchHalfwayJobs(
      {
        ...deps,
        loadHalfwayState: (job) => prepareEmail("halfway_state", () => loadHalfwayState(job)),
      },
      { limit },
    ),
  );

  // Final Rescue is terminal but outranks the two lower inactivity
  // messages: a due Final Rescue closes Stalled and Start Day 1.
  const { loadFinalRescueState } = await import("@/lib/email/final-rescue-state.server");
  const finalRescue = await lifecycle("final_rescue", () =>
    dispatchFinalRescueJobs(
      {
        ...deps,
        loadFinalRescueState: (job) =>
          prepareEmail("final_rescue_state", () => loadFinalRescueState(job)),
      },
      { limit },
    ),
  );

  const { loadStalledState } = await import("@/lib/email/stalled-state.server");
  const stalled = await lifecycle("stalled", () =>
    dispatchStalledJobs(
      {
        ...deps,
        loadStalledState: (job) => prepareEmail("stalled_state", () => loadStalledState(job)),
      },
      { limit },
    ),
  );

  // Start Day 1 shares the runtime, store, lease claim, and adapter. Its
  // authoritative read-only state loader is injected here.
  const { loadStartDayOneState } = await import("@/lib/email/start-day-1-state.server");
  const startDayOne = await lifecycle("start_day_1", () =>
    dispatchStartDayOneJobs(
      {
        ...deps,
        loadStartDayOneState: (job) =>
          prepareEmail("start_day_1_state", () => loadStartDayOneState(job)),
      },
      { limit },
    ),
  );

  return {
    planReady,
    recovery,
    planCompleted,
    halfway,
    finalRescue,
    stalled,
    startDayOne,
    staleAlerts,
  };
}
