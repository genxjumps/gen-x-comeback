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

export type HalfwayCancelReason =
  | "job_not_canonical"
  | "plan_version_replaced"
  | "recipient_missing"
  | "plan_completed"
  | "progress_window_not_reached"
  | "progress_window_passed"
  | "marketing_unsubscribed"
  | "recipient_suppressed"
  | "plan_ready_not_accepted"
  | "eligibility_floor_not_reached"
  | "lifecycle_24h_cap";

/**
 * How the dispatcher should transition the job:
 * - defer: not yet sendable, keep the job for a later run
 * - cancel: permanently not applicable to this plan version
 * - suppress: recipient must not receive lifecycle email
 */
export type HalfwayCancelDisposition = "defer" | "cancel" | "suppress";

export type HalfwayResolution =
  | { action: "SEND" }
  | {
      action: "CANCEL";
      reason: HalfwayCancelReason;
      disposition: HalfwayCancelDisposition;
      /** Earliest ISO time a deferred job could become eligible, when known. */
      eligibleAt?: string;
    };

const DISPOSITIONS: Record<HalfwayCancelReason, HalfwayCancelDisposition> = {
  job_not_canonical: "cancel",
  plan_version_replaced: "cancel",
  recipient_missing: "cancel",
  // A finished plan belongs to Plan Completed, permanently, for this version.
  plan_completed: "cancel",
  // Progress only moves forward within a plan version, so a window miss in
  // either direction is permanent for this job.
  progress_window_not_reached: "cancel",
  progress_window_passed: "cancel",
  marketing_unsubscribed: "suppress",
  recipient_suppressed: "suppress",
  plan_ready_not_accepted: "defer",
  eligibility_floor_not_reached: "defer",
  lifecycle_24h_cap: "defer",
};

function cancel(reason: HalfwayCancelReason, eligibleAt?: string): HalfwayResolution {
  return {
    action: "CANCEL",
    reason,
    disposition: DISPOSITIONS[reason],
    ...(eligibleAt ? { eligibleAt } : {}),
  };
}

function ms(iso: string): number {
  return new Date(iso).getTime();
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

  if (!state.hasRecipient) return cancel("recipient_missing");

  // Plan Completed control, or an authoritatively complete plan, always cancels.
  // There is no timestamp comparison and no tie-breaker at this boundary.
  if (state.planCompletedControl || state.planComplete) return cancel("plan_completed");

  if (state.requiredCompletions < HALFWAY_MIN_COMPLETIONS) {
    return cancel("progress_window_not_reached");
  }
  if (state.requiredCompletions > HALFWAY_MAX_COMPLETIONS) {
    return cancel("progress_window_passed");
  }

  if (state.marketingUnsubscribedAt) return cancel("marketing_unsubscribed");
  if (state.emailSuppressedAt || state.suppressionListed) return cancel("recipient_suppressed");

  if (!state.planReadyAcceptedAt) return cancel("plan_ready_not_accepted");

  const floor = ms(job.eligible_at);
  if (now.getTime() < floor) {
    return cancel("eligibility_floor_not_reached", new Date(floor).toISOString());
  }

  if (state.lastLifecycleAcceptedAt) {
    const nextAllowed = ms(state.lastLifecycleAcceptedAt) + LIFECYCLE_MIN_GAP_MS;
    if (now.getTime() < nextAllowed) {
      return cancel("lifecycle_24h_cap", new Date(nextAllowed).toISOString());
    }
  }

  return { action: "SEND" };
}
