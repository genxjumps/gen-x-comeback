// Deterministic, pure dispatch-time resolver for the Start Day 1 email.
//
// It reads persisted state only. URL parameters, browser state, provider opens,
// provider clicks, and passive page visits are never inputs. It performs no IO
// and mutates nothing: job status transitions and event recording belong to a
// later dispatcher checkpoint.
import {
  START_DAY_1_ELIGIBILITY_DELAY_MS,
  START_DAY_1_JOB_TYPE,
  START_DAY_1_JOB_VERSION,
  START_DAY_1_TEMPLATE_VERSION,
} from "@/lib/email/types";

/** One lifecycle email per rolling 24 hours, Plan Ready excluded. */
export const LIFECYCLE_MIN_GAP_MS = 24 * 60 * 60 * 1000;

/** At most three accepted inactivity emails per plan. */
export const MAX_ACCEPTED_INACTIVITY_EMAILS = 3;

/** Inactivity email types counted against the per-plan cap. */
export const INACTIVITY_JOB_TYPES = ["start_day_1", "stalled", "final_rescue"] as const;

/**
 * Whether a due, unsent Final Rescue job currently controls inactivity
 * messaging for its plan version.
 *
 * Shared by the lower-priority Start Day 1 and Stalled resolvers, and declared
 * here alongside the other shared inactivity rules so neither lower resolver
 * has to import the Final Rescue resolver. A due current Final Rescue job that
 * is not blocked by Halfway controls those messages even while Final Rescue is
 * still retrying or has not yet been provider accepted.
 */
export function finalRescueDueControls(
  finalRescueDueAt: string | null,
  halfwayPending: boolean,
  now: Date,
): boolean {
  if (!finalRescueDueAt) return false;
  if (halfwayPending) return false;
  return now.getTime() >= new Date(finalRescueDueAt).getTime();
}

export type StartDayOneJob = {
  job_id: string;
  job_type: string;
  job_version: string;
  template_version: string;
  lead_plan_id: string;
  plan_version_id: string;
  /** Normal floor: plan creation + 24 hours. */
  eligible_at: string;
};

/**
 * Authoritative persisted state required to resolve one Start Day 1 job.
 * Contains no personal or assessment data beyond recipient presence.
 */
export type StartDayOneState = {
  job: StartDayOneJob;
  /** Current plan version of the lead plan, or null when the plan is gone. */
  currentPlanVersionId: string | null;
  /** True only when a deliverable recipient address is persisted. */
  hasRecipient: boolean;
  marketingUnsubscribedAt: string | null;
  /** Persisted hard-bounce or complaint suppression on the lead plan. */
  emailSuppressedAt: string | null;
  /** Suppression list membership (hard bounce or complaint). */
  suppressionListed: boolean;
  /** Deliberate Day 1 start row for the current plan version. */
  dayOneStartedAt: string | null;
  dayOneCompletedAt: string | null;
  /** Plan Ready provider acceptance time for this plan version. */
  planReadyAcceptedAt: string | null;
  /** Most recent accepted non-Plan-Ready lifecycle email for this plan. */
  lastLifecycleAcceptedAt: string | null;
  /** Count of accepted inactivity emails for this plan. */
  acceptedInactivityCount: number;
  /** True when an unsent Halfway job still controls the shared lifecycle gap. */
  halfwayPending: boolean;
  /** Provider acceptance time of Final Rescue for this plan version, if any. */
  finalRescueAcceptedAt: string | null;
  /** Eligibility horizon of the single unsent Final Rescue job, if one exists. */
  finalRescueDueAt: string | null;
};

export type CancelReason =
  | "job_not_canonical"
  | "plan_version_replaced"
  | "recipient_missing"
  | "day_1_complete"
  | "final_rescue_sent"
  | "final_rescue_controls"
  | "marketing_unsubscribed"
  | "recipient_suppressed"
  | "plan_ready_not_accepted"
  | "eligibility_floor_not_reached"
  | "lifecycle_24h_cap"
  | "inactivity_cap_reached";

/**
 * How a later dispatcher should transition the job:
 * - defer: not yet eligible, keep the job for a later run
 * - cancel: permanently not applicable to this plan version
 * - suppress: recipient must not receive lifecycle email
 */
export type CancelDisposition = "defer" | "cancel" | "suppress";

export type StartDayOneResolution =
  | { action: "START" }
  | { action: "RESUME" }
  | {
      action: "CANCEL";
      reason: CancelReason;
      disposition: CancelDisposition;
      /** Earliest ISO time a deferred job could become eligible, when known. */
      eligibleAt?: string;
    };

const DISPOSITIONS: Record<CancelReason, CancelDisposition> = {
  job_not_canonical: "cancel",
  plan_version_replaced: "cancel",
  recipient_missing: "cancel",
  day_1_complete: "cancel",
  final_rescue_sent: "cancel",
  final_rescue_controls: "cancel",
  marketing_unsubscribed: "suppress",
  recipient_suppressed: "suppress",
  plan_ready_not_accepted: "defer",
  eligibility_floor_not_reached: "defer",
  lifecycle_24h_cap: "defer",
  inactivity_cap_reached: "cancel",
};

function cancel(reason: CancelReason, eligibleAt?: string): StartDayOneResolution {
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
 * Effective eligibility floor.
 *
 * The normal floor is the job's own eligible_at (plan creation + 24 hours).
 * Only when Plan Ready was accepted after that normal floor does the floor
 * move to acceptance + 24 hours. A Plan Ready accepted normally (before the
 * original floor) never adds another 24 hours.
 */
export function effectiveFloorMs(eligibleAtIso: string, planReadyAcceptedAtIso: string): number {
  const normal = ms(eligibleAtIso);
  const accepted = ms(planReadyAcceptedAtIso);
  return accepted > normal ? accepted + START_DAY_1_ELIGIBILITY_DELAY_MS : normal;
}

/**
 * Resolves one claimed Start Day 1 job. Safe to call immediately after the
 * existing shared lease claim.
 */
export function resolveStartDayOne(state: StartDayOneState, now: Date): StartDayOneResolution {
  const { job } = state;

  if (
    job.job_type !== START_DAY_1_JOB_TYPE ||
    job.job_version !== START_DAY_1_JOB_VERSION ||
    job.template_version !== START_DAY_1_TEMPLATE_VERSION
  ) {
    return cancel("job_not_canonical");
  }

  if (!state.currentPlanVersionId || state.currentPlanVersionId !== job.plan_version_id) {
    return cancel("plan_version_replaced");
  }

  if (!state.hasRecipient) return cancel("recipient_missing");

  if (state.dayOneCompletedAt) return cancel("day_1_complete");

  // Final Rescue closure and control. An accepted Final Rescue permanently
  // closes later inactivity messaging for this plan version. A due unsent Final
  // Rescue job that is not blocked by Halfway controls this lower inactivity
  // message even while Final Rescue is still retrying.
  if (state.finalRescueAcceptedAt) return cancel("final_rescue_sent");
  if (finalRescueDueControls(state.finalRescueDueAt, state.halfwayPending, now)) {
    return cancel("final_rescue_controls");
  }



  if (state.marketingUnsubscribedAt) return cancel("marketing_unsubscribed");
  if (state.emailSuppressedAt || state.suppressionListed) return cancel("recipient_suppressed");

  if (!state.planReadyAcceptedAt) return cancel("plan_ready_not_accepted");

  const floor = effectiveFloorMs(job.eligible_at, state.planReadyAcceptedAt);
  if (now.getTime() < floor) {
    return cancel("eligibility_floor_not_reached", new Date(floor).toISOString());
  }

  if (state.lastLifecycleAcceptedAt) {
    const nextAllowed = ms(state.lastLifecycleAcceptedAt) + LIFECYCLE_MIN_GAP_MS;
    if (now.getTime() < nextAllowed) {
      return cancel("lifecycle_24h_cap", new Date(nextAllowed).toISOString());
    }
  }

  if (state.acceptedInactivityCount >= MAX_ACCEPTED_INACTIVITY_EMAILS) {
    return cancel("inactivity_cap_reached");
  }

  return state.dayOneStartedAt ? { action: "RESUME" } : { action: "START" };
}
