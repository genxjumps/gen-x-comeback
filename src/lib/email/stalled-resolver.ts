// Deterministic, pure dispatch-time resolver for the Stalled email (7.10.2).
//
// It reads persisted state only. URL parameters, browser state, provider opens,
// provider clicks, workout starts, and passive page visits are never inputs. It
// performs no IO and mutates nothing: job transitions and event recording belong
// to the dispatcher, exactly as they do for Halfway and Start Day 1.
import {
  STALLED_ELIGIBILITY_DELAY_MS,
  STALLED_JOB_TYPE,
  STALLED_JOB_VERSION,
  STALLED_MAX_REQUIRED_DAY,
  STALLED_MIN_REQUIRED_DAY,
  STALLED_TEMPLATE_VERSION,
} from "@/lib/email/types";
import {
  LIFECYCLE_MIN_GAP_MS,
  MAX_ACCEPTED_INACTIVITY_EMAILS,
} from "@/lib/email/start-day-1-resolver";

/**
 * Logical episode key. One Stalled episode exists per required day that a
 * reader actually completed, so the key is the sole episode uniqueness boundary.
 */
export function stalledEpisodeKey(planVersionId: string, requiredDayNumber: number): string {
  return `stalled:${planVersionId}:after_day:${requiredDayNumber}:${STALLED_JOB_VERSION}`;
}

/**
 * Required day number encoded in a Stalled episode key, or null when the key is
 * not a canonical Stalled episode key for this plan version.
 */
export function parseStalledEpisodeDay(
  idempotencyKey: string | null | undefined,
  planVersionId: string,
): number | null {
  if (!idempotencyKey) return null;
  const match = /^stalled:(.+):after_day:(\d+):v1$/.exec(idempotencyKey);
  if (!match) return null;
  if (match[1] !== planVersionId) return null;
  const day = Number(match[2]);
  return Number.isInteger(day) && day > 0 ? day : null;
}

export type StalledJob = {
  job_id: string;
  job_type: string;
  job_version: string;
  template_version: string;
  lead_plan_id: string;
  plan_version_id: string;
  /** Logical episode key: stalled:{plan_version_id}:after_day:{n}:v1. */
  idempotency_key: string;
  /** Persisted completion anchor plus 48 hours. */
  eligible_at: string;
};

/**
 * Authoritative persisted state required to resolve one Stalled job.
 * Contains no personal or assessment data beyond recipient presence.
 */
export type StalledState = {
  job: StalledJob;
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
  /** True when a Plan Completed job exists for this plan version, in any state. */
  planCompletedControl: boolean;
  /** True when an unsent Halfway job still controls the shared lifecycle gap. */
  halfwayPending: boolean;
  /** True when a Final Rescue message was already accepted for this plan version. */
  finalRescueAccepted: boolean;
  /** Highest required day number with a persisted completion, if any. */
  latestRequiredCompletedDay: number | null;
  /** Persisted completion timestamp this episode is anchored to. */
  episodeAnchorCompletedAt: string | null;
  /** Plan Ready provider acceptance time for this plan version. */
  planReadyAcceptedAt: string | null;
  /** Most recent accepted non-Plan-Ready lifecycle email for this plan version. */
  lastLifecycleAcceptedAt: string | null;
  /** Accepted inactivity emails for this plan version. */
  acceptedInactivityCount: number;
};

/** Permanent, plan-version-scoped non-applicability. */
export type StalledCancelReason =
  | "job_not_canonical"
  | "plan_version_replaced"
  | "plan_completed"
  | "final_rescue_sent"
  | "recipient_missing"
  | "progress_not_started"
  | "progress_window_passed"
  | "episode_superseded"
  | "episode_anchor_missing"
  | "inactivity_cap_reached";

/** Recipient must not receive lifecycle email at all. */
export type StalledSuppressReason = "marketing_unsubscribed" | "recipient_suppressed";

/** Not sendable yet; the job is kept for a later dispatch run. */
export type StalledDeferReason =
  | "stall_window_not_reached"
  | "halfway_priority"
  | "plan_ready_not_accepted"
  | "lifecycle_24h_cap";

/** The four approved Stalled dispatch outcomes as an explicit union. */
export type StalledResolution =
  | { action: "SEND" }
  | {
      action: "DEFER";
      reason: StalledDeferReason;
      /** Earliest ISO time this job could become eligible, when known. */
      eligibleAt?: string;
    }
  | { action: "CANCEL"; reason: StalledCancelReason }
  | { action: "SUPPRESS"; reason: StalledSuppressReason };

function cancel(reason: StalledCancelReason): StalledResolution {
  return { action: "CANCEL", reason };
}

function suppress(reason: StalledSuppressReason): StalledResolution {
  return { action: "SUPPRESS", reason };
}

function defer(reason: StalledDeferReason, eligibleAt?: string): StalledResolution {
  return { action: "DEFER", reason, ...(eligibleAt ? { eligibleAt } : {}) };
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Exact 48-hour stall threshold: the persisted completion anchor plus 48 hours,
 * never earlier than the job's own eligibility floor. A retry can never move it.
 */
export function stalledThresholdMs(anchorCompletedAtIso: string, eligibleAtIso: string): number {
  return Math.max(ms(anchorCompletedAtIso) + STALLED_ELIGIBILITY_DELAY_MS, ms(eligibleAtIso));
}

/**
 * Resolves one claimed Stalled job against freshly reloaded persisted state, so
 * late required progress, a completed plan, a suppression, or an exhausted
 * inactivity cap still stops the send before any render or provider call.
 */
export function resolveStalled(state: StalledState, now: Date): StalledResolution {
  const { job } = state;

  if (
    job.job_type !== STALLED_JOB_TYPE ||
    job.job_version !== STALLED_JOB_VERSION ||
    job.template_version !== STALLED_TEMPLATE_VERSION
  ) {
    return cancel("job_not_canonical");
  }

  const episodeDay = parseStalledEpisodeDay(job.idempotency_key, job.plan_version_id);
  if (
    episodeDay === null ||
    episodeDay < STALLED_MIN_REQUIRED_DAY ||
    episodeDay > STALLED_MAX_REQUIRED_DAY
  ) {
    return cancel("job_not_canonical");
  }

  if (!state.currentPlanVersionId || state.currentPlanVersionId !== job.plan_version_id) {
    return cancel("plan_version_replaced");
  }

  // Plan Completed control, or an authoritatively complete plan, always wins.
  if (state.planCompletedControl || state.planComplete) return cancel("plan_completed");

  // Final Rescue permanently closes later inactivity messaging.
  if (state.finalRescueAccepted) return cancel("final_rescue_sent");

  if (!state.hasRecipient) return cancel("recipient_missing");

  if (state.requiredCompletions < STALLED_MIN_REQUIRED_DAY) return cancel("progress_not_started");
  if (state.requiredCompletions > STALLED_MAX_REQUIRED_DAY) return cancel("progress_window_passed");

  // A newer required completion supersedes this episode: continuous inactivity
  // can never repeat, and a later episode always needs newer required progress.
  if (state.latestRequiredCompletedDay !== episodeDay) return cancel("episode_superseded");

  if (state.marketingUnsubscribedAt) return suppress("marketing_unsubscribed");
  if (state.emailSuppressedAt || state.suppressionListed) return suppress("recipient_suppressed");

  if (!state.episodeAnchorCompletedAt) return cancel("episode_anchor_missing");

  const threshold = stalledThresholdMs(state.episodeAnchorCompletedAt, job.eligible_at);
  if (now.getTime() < threshold) {
    return defer("stall_window_not_reached", new Date(threshold).toISOString());
  }

  // Halfway outranks Stalled: an unsent Halfway job for this plan version keeps
  // the shared lifecycle gap, so Stalled waits without any provider attempt.
  if (state.halfwayPending) return defer("halfway_priority");

  if (!state.planReadyAcceptedAt) return defer("plan_ready_not_accepted");

  if (state.lastLifecycleAcceptedAt) {
    const nextAllowed = ms(state.lastLifecycleAcceptedAt) + LIFECYCLE_MIN_GAP_MS;
    if (now.getTime() < nextAllowed) {
      return defer("lifecycle_24h_cap", new Date(nextAllowed).toISOString());
    }
  }

  if (state.acceptedInactivityCount >= MAX_ACCEPTED_INACTIVITY_EMAILS) {
    return cancel("inactivity_cap_reached");
  }

  return { action: "SEND" };
}
