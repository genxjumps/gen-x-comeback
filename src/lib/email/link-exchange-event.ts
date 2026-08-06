// Trusted server-side canonical event selection for a completed /return token
// exchange. Pure and read-only: no IO, no environment reads, no client input.
//
// The event is chosen only from validated server-side state (token purpose plus
// the originating job's type, version, template version, and lead/plan
// ownership). A raw GET, prefetch, scanner, provider open, or provider click
// never reaches here.
import {
  FINAL_RESCUE_JOB_TYPE,
  FINAL_RESCUE_JOB_VERSION,
  FINAL_RESCUE_TEMPLATE_VERSION,
  HALFWAY_JOB_TYPE,
  HALFWAY_JOB_VERSION,
  HALFWAY_TEMPLATE_VERSION,
  PLAN_COMPLETED_JOB_TYPE,
  PLAN_COMPLETED_JOB_VERSION,
  PLAN_COMPLETED_TEMPLATE_VERSION,
  STALLED_JOB_TYPE,
  STALLED_JOB_VERSION,
  STALLED_TEMPLATE_VERSION,
  START_DAY_1_JOB_TYPE,
  START_DAY_1_JOB_VERSION,
  START_DAY_1_TEMPLATE_VERSION,
} from "@/lib/email/types";
import {
  OPEN_PLAN_TOKEN_PURPOSE,
  type ReturnTokenJobIdentity,
} from "@/lib/email/return-destination";

/** General exchange event, kept for Plan Ready and job-less tokens. */
export const PLAN_READY_LINK_EXCHANGE_EVENT = "email_plan_ready_link_exchange_completed";

/** Emitted only for a deliberate valid open_plan exchange of a Halfway job token. */
export const HALFWAY_LINK_EXCHANGE_EVENT = "email_halfway_link_exchange_completed";

/** Emitted only for a deliberate valid open_plan exchange of a Start Day 1 token. */
export const START_DAY_1_LINK_EXCHANGE_EVENT = "email_start_day_1_link_exchange_completed";

/** Emitted only for a deliberate valid open_plan exchange of a Stalled job token. */
export const STALLED_LINK_EXCHANGE_EVENT = "email_stalled_link_exchange_completed";

/** Emitted only for a deliberate valid open_plan exchange of a Final Rescue token. */
export const FINAL_RESCUE_LINK_EXCHANGE_EVENT = "email_final_rescue_link_exchange_completed";

/** Emitted only for a deliberate valid open_plan exchange of a Plan Completed token. */
export const PLAN_COMPLETED_LINK_EXCHANGE_EVENT = "email_plan_completed_link_exchange_completed";


export type LinkExchangeEventInput = {
  /** `plan_return_tokens.purpose` of the validated token. */
  purpose: string | null | undefined;
  /** Validated lead/plan identity of the token, already matched to the lead. */
  leadPlanId: string;
  planVersionId: string;
  /** Originating email job, or null when the token has no job association. */
  job?: (ReturnTokenJobIdentity & { jobId?: string | null }) | null;
};

/**
 * Exactly one canonical exchange event name.
 *
 * Halfway and Start Day 1 are each selected only when the token purpose is
 * `open_plan` and the originating job is that lifecycle's canonical job type,
 * job version, and template version, owned by exactly the same validated lead
 * and plan version. Job-less tokens, Plan Ready jobs, mismatched ownership,
 * mismatched job or template version, and recovery-purpose tokens all keep the
 * general Plan Ready event.
 */
export function resolveLinkExchangeEvent(input: LinkExchangeEventInput): string {
  return resolveLinkExchangeAttribution(input).eventName;
}

/** Canonical identity a lifecycle exchange event is attributed to. */
type LifecycleExchangeContract = {
  jobType: string;
  jobVersion: string;
  templateVersion: string;
  eventName: string;
};

const LIFECYCLE_EXCHANGE_CONTRACTS: readonly LifecycleExchangeContract[] = [
  {
    jobType: HALFWAY_JOB_TYPE,
    jobVersion: HALFWAY_JOB_VERSION,
    templateVersion: HALFWAY_TEMPLATE_VERSION,
    eventName: HALFWAY_LINK_EXCHANGE_EVENT,
  },
  {
    jobType: START_DAY_1_JOB_TYPE,
    jobVersion: START_DAY_1_JOB_VERSION,
    templateVersion: START_DAY_1_TEMPLATE_VERSION,
    eventName: START_DAY_1_LINK_EXCHANGE_EVENT,
  },
  {
    jobType: STALLED_JOB_TYPE,
    jobVersion: STALLED_JOB_VERSION,
    templateVersion: STALLED_TEMPLATE_VERSION,
    eventName: STALLED_LINK_EXCHANGE_EVENT,
  },
  {
    jobType: FINAL_RESCUE_JOB_TYPE,
    jobVersion: FINAL_RESCUE_JOB_VERSION,
    templateVersion: FINAL_RESCUE_TEMPLATE_VERSION,
    eventName: FINAL_RESCUE_LINK_EXCHANGE_EVENT,
  },
];

/**
 * Trusted attribution for a completed exchange: the canonical event name and,
 * for a lifecycle-specific exchange only, the originating job id. The job id is
 * an internal identifier, so including it keeps the no-PII event boundary intact.
 */
export function resolveLinkExchangeAttribution(input: LinkExchangeEventInput): {
  eventName: string;
  jobId: string | null;
} {
  const general = { eventName: PLAN_READY_LINK_EXCHANGE_EVENT, jobId: null };
  if (input.purpose !== OPEN_PLAN_TOKEN_PURPOSE) return general;

  const job = input.job;
  if (!job) return general;
  if (!job.jobId) return general;
  if (!job.leadPlanId || job.leadPlanId !== input.leadPlanId) return general;
  if (!job.planVersionId || job.planVersionId !== input.planVersionId) return general;

  const contract = LIFECYCLE_EXCHANGE_CONTRACTS.find(
    (candidate) =>
      candidate.jobType === job.jobType &&
      candidate.jobVersion === job.jobVersion &&
      candidate.templateVersion === job.templateVersion,
  );
  if (!contract) return general;

  return { eventName: contract.eventName, jobId: job.jobId };
}
