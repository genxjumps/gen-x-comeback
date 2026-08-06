// Canonical lifecycle event naming. Pure: no IO, no environment reads.
//
// Each job type owns one canonical event namespace. Naming is derived from the
// trusted job type only, never from provider payloads or client input, and no
// personal or private state is ever part of an event name.
import {
  FINAL_RESCUE_JOB_TYPE,
  HALFWAY_JOB_TYPE,
  PLAN_COMPLETED_JOB_TYPE,
  PLAN_READY_JOB_TYPE,
  RECOVERY_JOB_TYPE,
  STALLED_JOB_TYPE,
  START_DAY_1_JOB_TYPE,
} from "@/lib/email/types";

/** Terminal or transitional outcomes that may emit a canonical event. */
export type LifecycleEventOutcome =
  | "provider_accepted"
  | "delivered"
  | "retry_scheduled"
  | "failed_permanent"
  | "suppressed"
  | "canceled"
  | "manual_review";

const PREFIXES: Record<string, string> = {
  [PLAN_READY_JOB_TYPE]: "email_plan_ready",
  [START_DAY_1_JOB_TYPE]: "email_start_day_1",
  [HALFWAY_JOB_TYPE]: "email_halfway",
  [STALLED_JOB_TYPE]: "email_stalled",
  [FINAL_RESCUE_JOB_TYPE]: "email_final_rescue",
  [PLAN_COMPLETED_JOB_TYPE]: "email_plan_completed",
  // Recovery is a product-access namespace, not a proactive lifecycle one.
  [RECOVERY_JOB_TYPE]: "email_recovery",
};

/**
 * Outcomes that do not emit a canonical event for a given job type.
 * Plan Ready cancellation stays silent, exactly as it already behaves.
 *
 * Halfway manual review stays silent too: Section 7.10.1 enumerates exactly
 * eight approved Halfway canonical events and none of them is a manual-review
 * event. The job still parks in its existing manual-review state and still
 * raises the existing operational alert; only the unapproved event is withheld.
 *
 * Stalled follows the identical rule for the same reason: Section 7.10.2
 * enumerates exactly eight approved Stalled canonical events.
 *
 * Final Rescue follows the identical established omission rule: exactly eight
 * approved canonical events, none of them a manual-review event. The existing
 * manual-review state and operational alert behavior is preserved.
 */
const OMITTED: Record<string, ReadonlySet<LifecycleEventOutcome>> = {
  [PLAN_READY_JOB_TYPE]: new Set<LifecycleEventOutcome>(["canceled"]),
  [HALFWAY_JOB_TYPE]: new Set<LifecycleEventOutcome>(["manual_review"]),
  [STALLED_JOB_TYPE]: new Set<LifecycleEventOutcome>(["manual_review"]),
  [FINAL_RESCUE_JOB_TYPE]: new Set<LifecycleEventOutcome>(["manual_review"]),
  [PLAN_COMPLETED_JOB_TYPE]: new Set<LifecycleEventOutcome>(["manual_review"]),
  // Recovery has exactly seven approved canonical events: queued,
  // provider_accepted, delivered, retry_scheduled, failed_permanent, suppressed,
  // and link_exchange_completed. Cancellation of a stale replaced-plan recovery
  // job and manual review therefore stay silent, exactly as Plan Ready
  // cancellation already does.
  [RECOVERY_JOB_TYPE]: new Set<LifecycleEventOutcome>(["canceled", "manual_review"]),
};

/** Canonical event name for one job type and outcome, or null when omitted. */
export function lifecycleEventName(jobType: string, outcome: LifecycleEventOutcome): string | null {
  const prefix = PREFIXES[jobType];
  if (!prefix) return null;
  if (OMITTED[jobType]?.has(outcome)) return null;
  return `${prefix}_${outcome}`;
}

/** Canonical delivered event name for one job type (webhook path only). */
export function deliveredEventName(jobType: string): string | null {
  return lifecycleEventName(jobType, "delivered");
}
