// Closed destination mapping for the deliberate /return token exchange.
// Pure and read-only: no IO, no environment reads, no client input.
import { START_DAY_1_JOB_TYPE, START_DAY_1_TEMPLATE_VERSION } from "@/lib/email/types";

/** The only destinations a completed exchange can ever redirect to. */
export const RETURN_DESTINATIONS = ["/your-plan", "/your-plan/day/1"] as const;

export type ReturnDestination = (typeof RETURN_DESTINATIONS)[number];

export const DEFAULT_RETURN_DESTINATION: ReturnDestination = "/your-plan";

export const START_DAY_1_RETURN_DESTINATION: ReturnDestination = "/your-plan/day/1";

/** Trusted server-side originating job identity for a return token. */
export type ReturnTokenJobIdentity = {
  jobType: string | null | undefined;
  templateVersion: string | null | undefined;
};

/**
 * Maps the trusted originating email job of a return token to a destination.
 *
 * Only a `start_day_1` / `start_day_1_v1` job (START or RESUME rendering, which
 * share that job contract) resolves to the Day 1 page. Every other case,
 * including tokens with no job association, Plan Ready jobs, and unknown or
 * mismatched job state, resolves to the general plan hub.
 */
export function resolveReturnDestination(
  job: ReturnTokenJobIdentity | null | undefined,
): ReturnDestination {
  if (!job) return DEFAULT_RETURN_DESTINATION;
  return job.jobType === START_DAY_1_JOB_TYPE &&
    job.templateVersion === START_DAY_1_TEMPLATE_VERSION
    ? START_DAY_1_RETURN_DESTINATION
    : DEFAULT_RETURN_DESTINATION;
}
