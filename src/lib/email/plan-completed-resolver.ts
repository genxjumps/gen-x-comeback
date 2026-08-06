// Deterministic, pure dispatch-time resolver for the Plan Completed email.
//
// It reads persisted state only. URL parameters, browser state, provider opens,
// provider clicks, return-link exchanges, and passive page visits are never
// inputs. It performs no IO and mutates nothing: job transitions and event
// recording belong to the dispatcher, exactly as they do for every other
// lifecycle message.
//
// Plan Completed is not an inactivity email: the three-accepted-inactivity-email
// cap never applies, and an accepted Final Rescue never cancels, suppresses, or
// defers it.
import {
  PLAN_COMPLETED_JOB_TYPE,
  PLAN_COMPLETED_JOB_VERSION,
  PLAN_COMPLETED_TEMPLATE_VERSION,
  planCompletedJobKey,
} from "@/lib/email/types";
import { LIFECYCLE_MIN_GAP_MS } from "@/lib/email/start-day-1-resolver";

export type PlanCompletedJob = {
  job_id: string;
  job_type: string;
  job_version: string;
  template_version: string;
  lead_plan_id: string;
  plan_version_id: string;
  /** Logical job key: plan_completed:{plan_version_id}:v1. */
  idempotency_key: string;
  /** Persisted final required completion timestamp: immediately eligible. */
  eligible_at: string;
};

/**
 * Authoritative persisted state required to resolve one Plan Completed job.
 * Contains no personal or assessment data beyond recipient presence.
 */
export type PlanCompletedState = {
  job: PlanCompletedJob;
  /** Current plan version of the lead plan, or null when the plan is gone. */
  currentPlanVersionId: string | null;
  /** True only when a deliverable recipient address is persisted. */
  hasRecipient: boolean;
  marketingUnsubscribedAt: string | null;
  /** Persisted hard-bounce or complaint suppression on the lead plan. */
  emailSuppressedAt: string | null;
  /** Suppression list membership (hard bounce or complaint). */
  suppressionListed: boolean;
  /** Authoritative flag: every required top-level plan day is complete. */
  planComplete: boolean;
  /** Provider acceptance time of Plan Completed itself for this plan version. */
  planCompletedAcceptedAt: string | null;
  /** Plan Ready provider acceptance time for this plan version. */
  planReadyAcceptedAt: string | null;
  /** Most recent accepted non-Plan-Ready lifecycle email for this plan version. */
  lastLifecycleAcceptedAt: string | null;
};

/** Permanent, plan-version-scoped non-applicability. */
export type PlanCompletedCancelReason =
  | "job_not_canonical"
  | "plan_version_replaced"
  | "plan_incomplete"
  | "already_sent"
  | "recipient_missing";

/** Recipient must not receive lifecycle email at all. */
export type PlanCompletedSuppressReason = "marketing_unsubscribed" | "recipient_suppressed";

/** Not sendable yet; the job is kept for a later dispatch run. */
export type PlanCompletedDeferReason =
  | "eligibility_not_reached"
  | "plan_ready_not_accepted"
  | "lifecycle_24h_cap";

/** The four approved Plan Completed dispatch outcomes as an explicit union. */
export type PlanCompletedResolution =
  | { action: "SEND" }
  | {
      action: "DEFER";
      reason: PlanCompletedDeferReason;
      /** Earliest ISO time this job could become eligible, when known. */
      eligibleAt?: string;
    }
  | { action: "CANCEL"; reason: PlanCompletedCancelReason }
  | { action: "SUPPRESS"; reason: PlanCompletedSuppressReason };

function cancel(reason: PlanCompletedCancelReason): PlanCompletedResolution {
  return { action: "CANCEL", reason };
}

function suppress(reason: PlanCompletedSuppressReason): PlanCompletedResolution {
  return { action: "SUPPRESS", reason };
}

function defer(reason: PlanCompletedDeferReason, eligibleAt?: string): PlanCompletedResolution {
  return { action: "DEFER", reason, ...(eligibleAt ? { eligibleAt } : {}) };
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Resolves one claimed Plan Completed job against freshly reloaded persisted
 * state, so a replaced plan version, an incomplete plan, a suppression, or an
 * existing acceptance still stops the send before any render or provider call.
 */
export function resolvePlanCompleted(
  state: PlanCompletedState,
  now: Date,
): PlanCompletedResolution {
  const { job } = state;

  if (
    job.job_type !== PLAN_COMPLETED_JOB_TYPE ||
    job.job_version !== PLAN_COMPLETED_JOB_VERSION ||
    job.template_version !== PLAN_COMPLETED_TEMPLATE_VERSION ||
    job.idempotency_key !== planCompletedJobKey(job.plan_version_id)
  ) {
    return cancel("job_not_canonical");
  }

  if (!state.currentPlanVersionId || state.currentPlanVersionId !== job.plan_version_id) {
    return cancel("plan_version_replaced");
  }

  // The job exists only because the completion boundary was reached. If the
  // authoritative state is no longer complete the job is not applicable.
  if (!state.planComplete) return cancel("plan_incomplete");

  // Plan Completed can never be accepted twice for one plan version.
  if (state.planCompletedAcceptedAt) return cancel("already_sent");

  if (!state.hasRecipient) return cancel("recipient_missing");

  // Unsubscribe, hard bounce, and complaint suppress the message. Plan access
  // is never affected here: this resolver only decides about sending.
  if (state.marketingUnsubscribedAt) return suppress("marketing_unsubscribed");
  if (state.emailSuppressedAt || state.suppressionListed) return suppress("recipient_suppressed");

  if (now.getTime() < ms(job.eligible_at)) {
    return defer("eligibility_not_reached", job.eligible_at);
  }

  if (!state.planReadyAcceptedAt) return defer("plan_ready_not_accepted");

  if (state.lastLifecycleAcceptedAt) {
    const nextAllowed = ms(state.lastLifecycleAcceptedAt) + LIFECYCLE_MIN_GAP_MS;
    if (now.getTime() < nextAllowed) {
      return defer("lifecycle_24h_cap", new Date(nextAllowed).toISOString());
    }
  }

  return { action: "SEND" };
}
