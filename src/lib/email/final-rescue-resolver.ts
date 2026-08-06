// Deterministic, pure dispatch-time resolver for the Final Rescue email.
//
// It reads persisted state only. URL parameters, browser state, provider opens,
// provider clicks, return-link exchanges, and passive page visits are never
// inputs. It performs no IO and mutates nothing: job transitions and event
// recording belong to the dispatcher, exactly as they do for Halfway, Stalled,
// and Start Day 1.
import {
  FINAL_RESCUE_JOB_TYPE,
  FINAL_RESCUE_JOB_VERSION,
  FINAL_RESCUE_TEMPLATE_VERSION,
  finalRescueJobKey,
} from "@/lib/email/types";
import {
  LIFECYCLE_MIN_GAP_MS,
  MAX_ACCEPTED_INACTIVITY_EMAILS,
} from "@/lib/email/start-day-1-resolver";

export type FinalRescueJob = {
  job_id: string;
  job_type: string;
  job_version: string;
  template_version: string;
  lead_plan_id: string;
  plan_version_id: string;
  /** Logical job key: final_rescue:{plan_version_id}:v1. */
  idempotency_key: string;
  /** Authoritative persisted horizon: commit + 4 days, or a re-anchor + 5 days. */
  eligible_at: string;
};

/**
 * Authoritative persisted state required to resolve one Final Rescue job.
 * Contains no personal or assessment data beyond recipient presence.
 */
export type FinalRescueState = {
  job: FinalRescueJob;
  /** Current plan version of the lead plan, or null when the plan is gone. */
  currentPlanVersionId: string | null;
  /** True only when a deliverable recipient address is persisted. */
  hasRecipient: boolean;
  marketingUnsubscribedAt: string | null;
  /** Persisted hard-bounce or complaint suppression on the lead plan. */
  emailSuppressedAt: string | null;
  /** Suppression list membership (hard bounce or complaint). */
  suppressionListed: boolean;
  /** Authoritative plan-complete flag: every required assignment is complete. */
  planComplete: boolean;
  /** True when a Plan Completed job exists for this plan version, in any state. */
  planCompletedControl: boolean;
  /** True when an unsent Halfway job still controls the shared lifecycle gap. */
  halfwayPending: boolean;
  /** Provider acceptance time of Final Rescue itself for this plan version. */
  finalRescueAcceptedAt: string | null;
  /** Persisted deliberate Day 1 start for the current plan version. */
  dayOneStartedAt: string | null;
  /**
   * Server-authoritative count of completions that match a top-level
   * plan_json.days required assignment. Nested optional Active Recovery
   * sessions never contribute.
   */
  requiredCompletions: number;
  /** Total top-level required assignments in the saved plan version. */
  totalRequiredAssignments: number;
  /** Plan Ready provider acceptance time for this plan version. */
  planReadyAcceptedAt: string | null;
  /** Most recent accepted non-Plan-Ready lifecycle email for this plan version. */
  lastLifecycleAcceptedAt: string | null;
  /** Accepted inactivity emails for this plan version. */
  acceptedInactivityCount: number;
};

/** The two approved template variants, derived only from persisted state. */
export type FinalRescueVariant = "unstarted" | "started";

/** Permanent, plan-version-scoped non-applicability. */
export type FinalRescueCancelReason =
  | "job_not_canonical"
  | "plan_version_replaced"
  | "plan_completed"
  | "already_sent"
  | "recipient_missing"
  | "inactivity_cap_reached";

/** Recipient must not receive lifecycle email at all. */
export type FinalRescueSuppressReason = "marketing_unsubscribed" | "recipient_suppressed";

/** Not sendable yet; the job is kept for a later dispatch run. */
export type FinalRescueDeferReason =
  | "eligibility_not_reached"
  | "halfway_priority"
  | "plan_ready_not_accepted"
  | "lifecycle_24h_cap";

/** The four approved Final Rescue dispatch outcomes as an explicit union. */
export type FinalRescueResolution =
  | { action: "SEND"; variant: FinalRescueVariant }
  | {
      action: "DEFER";
      reason: FinalRescueDeferReason;
      /** Earliest ISO time this job could become eligible, when known. */
      eligibleAt?: string;
    }
  | { action: "CANCEL"; reason: FinalRescueCancelReason }
  | { action: "SUPPRESS"; reason: FinalRescueSuppressReason };

function cancel(reason: FinalRescueCancelReason): FinalRescueResolution {
  return { action: "CANCEL", reason };
}

function suppress(reason: FinalRescueSuppressReason): FinalRescueResolution {
  return { action: "SUPPRESS", reason };
}

function defer(reason: FinalRescueDeferReason, eligibleAt?: string): FinalRescueResolution {
  return { action: "DEFER", reason, ...(eligibleAt ? { eligibleAt } : {}) };
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Template variant, derived only from persisted deliberate Day 1 start and
 * required progress. Client input never selects a variant.
 */
export function finalRescueVariant(
  state: Pick<FinalRescueState, "dayOneStartedAt" | "requiredCompletions">,
): FinalRescueVariant {
  return state.dayOneStartedAt || state.requiredCompletions > 0 ? "started" : "unstarted";
}

/**
 * Shared inactivity-control helper, declared alongside the other shared
 * inactivity rules and re-exported here for Final Rescue call sites.
 */
export { finalRescueDueControls } from "@/lib/email/start-day-1-resolver";

/**
 * Resolves one claimed Final Rescue job against freshly reloaded persisted
 * state, so a completed plan, new progress, a suppression, or an exhausted
 * inactivity cap still stops the send before any render or provider call.
 */
export function resolveFinalRescue(state: FinalRescueState, now: Date): FinalRescueResolution {
  const { job } = state;

  if (
    job.job_type !== FINAL_RESCUE_JOB_TYPE ||
    job.job_version !== FINAL_RESCUE_JOB_VERSION ||
    job.template_version !== FINAL_RESCUE_TEMPLATE_VERSION ||
    job.idempotency_key !== finalRescueJobKey(job.plan_version_id)
  ) {
    return cancel("job_not_canonical");
  }

  if (!state.currentPlanVersionId || state.currentPlanVersionId !== job.plan_version_id) {
    return cancel("plan_version_replaced");
  }

  // Plan Completed control, or an authoritatively complete plan, always wins.
  if (state.planCompletedControl || state.planComplete) return cancel("plan_completed");

  // Final Rescue is terminal: it can never be accepted twice for one version.
  if (state.finalRescueAcceptedAt) return cancel("already_sent");

  if (!state.hasRecipient) return cancel("recipient_missing");

  // Unsubscribe, hard bounce, and complaint suppress the message. Plan access
  // is never affected here: this resolver only decides about sending.
  if (state.marketingUnsubscribedAt) return suppress("marketing_unsubscribed");
  if (state.emailSuppressedAt || state.suppressionListed) return suppress("recipient_suppressed");

  if (now.getTime() < ms(job.eligible_at)) {
    return defer("eligibility_not_reached", job.eligible_at);
  }

  // Halfway outranks Final Rescue: an unsent Halfway job for this plan version
  // keeps the shared lifecycle gap, so Final Rescue waits without any provider
  // attempt and without consuming retry budget.
  if (state.halfwayPending) return defer("halfway_priority");

  if (!state.planReadyAcceptedAt) return defer("plan_ready_not_accepted");

  if (state.lastLifecycleAcceptedAt) {
    const nextAllowed = ms(state.lastLifecycleAcceptedAt) + LIFECYCLE_MIN_GAP_MS;
    if (now.getTime() < nextAllowed) {
      return defer("lifecycle_24h_cap", new Date(nextAllowed).toISOString());
    }
  }

  // Final Rescue never bypasses the three-accepted-inactivity-email cap.
  if (state.acceptedInactivityCount >= MAX_ACCEPTED_INACTIVITY_EMAILS) {
    return cancel("inactivity_cap_reached");
  }

  return { action: "SEND", variant: finalRescueVariant(state) };
}
