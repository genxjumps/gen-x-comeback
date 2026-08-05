// Deterministic, pure dispatch-time resolver for the Halfway email (7.10.1).
//
// It reads persisted state only. URL parameters, browser state, provider opens,
// provider clicks, and passive page visits are never inputs. It performs no IO
// and mutates nothing: job transitions and event recording belong to the
// dispatcher, exactly as they do for Start Day 1.
import {
  HALFWAY_JOB_TYPE,
  HALFWAY_JOB_VERSION,
  HALFWAY_MAX_COMPLETIONS,
  HALFWAY_MIN_COMPLETIONS,
  HALFWAY_TEMPLATE_VERSION,
} from "@/lib/email/types";
import { LIFECYCLE_MIN_GAP_MS } from "@/lib/email/start-day-1-resolver";

export type HalfwayJob = {
  job_id: string;
  job_type: string;
  job_version: string;
  template_version: string;
  lead_plan_id: string;
  plan_version_id: string;
  /** Earliest attemptable time. Halfway is created already eligible. */
  eligible_at: string;
};

/**
 * Authoritative persisted state required to resolve one Halfway job.
 * Contains no personal or assessment data beyond recipient presence.
 */
export type HalfwayState = {
  job: HalfwayJob;
  /** Current plan version of the lead plan, or null when the plan is gone. */
  currentPlanVersionId: string | null;
  /** True only when a deliverable recipient address is persisted. */
  hasRecipient: boolean;
  marketingUnsubscribedAt: string | null;
  /** Persisted hard-bounce or complaint suppression on the lead plan. */
  emailSuppressedAt: string | null;
  /** Suppression list membership (hard bounce or complaint). */
  suppressionListed: boolean;
  /**
   * Server-authoritative count of completions that match a top-level
   * plan_json.days required assignment. Nested optional Active Recovery
   * sessions never contribute.
   */
  requiredCompletions: number;
  /** Total top-level required assignments in the saved plan version. */
  totalRequiredAssignments: number;
  /** Authoritative plan-complete flag: every required assignment is complete. */
  planComplete: boolean;
  /**
   * True when the Plan Completed lifecycle message already controls this plan
   * version (its job exists in any state). It always wins, with no timestamp
   * tie-breaker of any kind.
   */
  planCompletedControl: boolean;
  /** Plan Ready provider acceptance time for this plan version. */
  planReadyAcceptedAt: string | null;
  /** Most recent accepted non-Plan-Ready lifecycle email for this plan. */
  lastLifecycleAcceptedAt: string | null;
};

/** Permanent, plan-version-scoped non-applicability. */
export type HalfwayCancelReason =
  | "job_not_canonical"
  | "plan_version_replaced"
  | "plan_completed"
  | "recipient_missing"
  | "progress_window_not_reached"
  | "progress_window_passed";

/** Recipient must not receive lifecycle email at all. */
export type HalfwaySuppressReason = "marketing_unsubscribed" | "recipient_suppressed";

/** Not sendable yet; the job is kept for a later dispatch run. */
export type HalfwayDeferReason = "plan_ready_not_accepted" | "eligibility_floor_not_reached" | "lifecycle_24h_cap";

/**
 * The four approved Halfway dispatch outcomes, as an explicit discriminated
 * union. DEFER and SUPPRESS are first-class actions, never a CANCEL variant.
 */
export type HalfwayResolution =
  | { action: "SEND" }
  | {
      action: "DEFER";
      reason: HalfwayDeferReason;
      /** Earliest ISO time this job could become eligible, when known. */
      eligibleAt?: string;
    }
  | { action: "CANCEL"; reason: HalfwayCancelReason }
  | { action: "SUPPRESS"; reason: HalfwaySuppressReason };

function cancel(reason: HalfwayCancelReason): HalfwayResolution {
  return { action: "CANCEL", reason };
}

function suppress(reason: HalfwaySuppressReason): HalfwayResolution {
  return { action: "SUPPRESS", reason };
}

function defer(reason: HalfwayDeferReason, eligibleAt?: string): HalfwayResolution {
  return { action: "DEFER", reason, ...(eligibleAt ? { eligibleAt } : {}) };
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Effective eligibility floor: the later of the job's own eligible_at and the
 * Plan Ready provider acceptance plus the 24-hour lifecycle gap.
 */
export function halfwayEffectiveFloorMs(
  eligibleAtIso: string,
  planReadyAcceptedAtIso: string,
): number {
  return Math.max(ms(eligibleAtIso), ms(planReadyAcceptedAtIso) + LIFECYCLE_MIN_GAP_MS);
}

/**
 * Resolves one claimed Halfway job. Safe to call immediately after the existing
 * shared lease claim, and intended to run on freshly reloaded state so late
 * progress (a 7th completion) or a suppression can still stop the send.
 */
export function resolveHalfway(state: HalfwayState, now: Date): HalfwayResolution {
  const { job } = state;

  if (
    job.job_type !== HALFWAY_JOB_TYPE ||
    job.job_version !== HALFWAY_JOB_VERSION ||
    job.template_version !== HALFWAY_TEMPLATE_VERSION
  ) {
    return cancel("job_not_canonical");
  }

  if (!state.currentPlanVersionId || state.currentPlanVersionId !== job.plan_version_id) {
    return cancel("plan_version_replaced");
  }

  // Plan Completed control, or an authoritatively complete plan, always wins.
  // Checked immediately after canonical job/current-plan validation and before
  // recipient, progress window, unsubscribe, suppression, Plan Ready ordering,
  // eligibility, and lifecycle timing. No timestamp or reason tie-breaker.
  if (state.planCompletedControl || state.planComplete) return cancel("plan_completed");

  if (!state.hasRecipient) return cancel("recipient_missing");

  if (state.requiredCompletions < HALFWAY_MIN_COMPLETIONS) {
    return cancel("progress_window_not_reached");
  }
  if (state.requiredCompletions > HALFWAY_MAX_COMPLETIONS) {
    return cancel("progress_window_passed");
  }

  if (state.marketingUnsubscribedAt) return suppress("marketing_unsubscribed");
  if (state.emailSuppressedAt || state.suppressionListed) return suppress("recipient_suppressed");

  if (!state.planReadyAcceptedAt) return defer("plan_ready_not_accepted");

  // Full global 24-hour lifecycle spacing: a recent Plan Ready acceptance defers
  // Halfway to acceptance + 24 hours, exactly like the Plan Ready ordering rule
  // Start Day 1 already applies.
  const floor = halfwayEffectiveFloorMs(job.eligible_at, state.planReadyAcceptedAt);
  if (now.getTime() < floor) {
    return defer("eligibility_floor_not_reached", new Date(floor).toISOString());
  }

  if (state.lastLifecycleAcceptedAt) {
    const nextAllowed = ms(state.lastLifecycleAcceptedAt) + LIFECYCLE_MIN_GAP_MS;
    if (now.getTime() < nextAllowed) {
      return defer("lifecycle_24h_cap", new Date(nextAllowed).toISOString());
    }
  }

  return { action: "SEND" };
}
