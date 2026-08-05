// Canonical lifecycle event naming. Pure: no IO, no environment reads.
//
// Each job type owns one canonical event namespace. Naming is derived from the
// trusted job type only, never from provider payloads or client input, and no
// personal or private state is ever part of an event name.
import { HALFWAY_JOB_TYPE, PLAN_READY_JOB_TYPE, START_DAY_1_JOB_TYPE } from "@/lib/email/types";

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
};

/**
 * Outcomes that do not emit a canonical event for a given job type.
 * Plan Ready cancellation stays silent, exactly as it already behaves.
 */
const OMITTED: Record<string, ReadonlySet<LifecycleEventOutcome>> = {
  [PLAN_READY_JOB_TYPE]: new Set<LifecycleEventOutcome>(["canceled"]),
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
