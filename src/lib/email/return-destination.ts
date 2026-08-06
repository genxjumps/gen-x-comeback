// Closed destination mapping for the deliberate /return token exchange.
// Pure and read-only: no IO, no environment reads, no client input.
import { START_DAY_1_JOB_TYPE, START_DAY_1_TEMPLATE_VERSION } from "@/lib/email/types";

/** The only destinations a completed exchange can ever redirect to. */
export const RETURN_DESTINATIONS = ["/your-plan", "/your-plan/day/1"] as const;

export type ReturnDestination = (typeof RETURN_DESTINATIONS)[number];

export const DEFAULT_RETURN_DESTINATION: ReturnDestination = "/your-plan";

export const START_DAY_1_RETURN_DESTINATION: ReturnDestination = "/your-plan/day/1";

/** The only token purpose that may ever open a specific day. */
export const OPEN_PLAN_TOKEN_PURPOSE = "open_plan";

/**
 * Purpose-limited on-demand recovery credential. A recovery token always opens
 * the general plan hub, never a specific day page.
 */
export const RECOVERY_TOKEN_PURPOSE = "recovery";


/** Trusted server-side originating job identity for a return token. */
export type ReturnTokenJobIdentity = {
  jobType: string | null | undefined;
  /** Job version; Halfway attribution requires the canonical `v1`. */
  jobVersion?: string | null;
  templateVersion: string | null | undefined;
  leadPlanId: string | null | undefined;
  planVersionId: string | null | undefined;
};

/** All trusted server-side token state the destination may depend on. */
export type ReturnDestinationInput = {
  /** `plan_return_tokens.purpose` of the validated token. */
  purpose: string | null | undefined;
  /** Validated lead/plan identity of the token (already matched to the lead). */
  leadPlanId: string;
  planVersionId: string;
  /** Originating email job, or null when the token has no job association. */
  job?: ReturnTokenJobIdentity | null;
};

/**
 * Maps fully trusted server-side token and job state to a closed destination.
 *
 * The Day 1 page is reachable only when the token purpose is `open_plan`, the
 * originating job is a `start_day_1` / `start_day_1_v1` job (START and RESUME
 * share that job contract), and that job belongs to exactly the same lead and
 * plan version as the validated token. Recovery-purpose tokens, mismatched job
 * ownership or version, Plan Ready jobs, Halfway jobs, Stalled jobs, tokens with
 * no job, and unknown or mismatched job state all resolve to the general plan
 * hub. A trusted Halfway or Stalled job association is deliberately part of that
 * closed default: both open the plan hub, never a specific day page.
 */
export function resolveReturnDestination(input: ReturnDestinationInput): ReturnDestination {
  if (input.purpose !== OPEN_PLAN_TOKEN_PURPOSE) return DEFAULT_RETURN_DESTINATION;

  const job = input.job;
  if (!job) return DEFAULT_RETURN_DESTINATION;
  if (job.jobType !== START_DAY_1_JOB_TYPE) return DEFAULT_RETURN_DESTINATION;
  if (job.templateVersion !== START_DAY_1_TEMPLATE_VERSION) return DEFAULT_RETURN_DESTINATION;
  if (!job.leadPlanId || job.leadPlanId !== input.leadPlanId) return DEFAULT_RETURN_DESTINATION;
  if (!job.planVersionId || job.planVersionId !== input.planVersionId) {
    return DEFAULT_RETURN_DESTINATION;
  }

  return START_DAY_1_RETURN_DESTINATION;
}
