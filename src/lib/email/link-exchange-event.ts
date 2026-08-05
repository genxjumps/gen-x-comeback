// Trusted server-side canonical event selection for a completed /return token
// exchange. Pure and read-only: no IO, no environment reads, no client input.
//
// The event is chosen only from validated server-side state (token purpose plus
// the originating job's type, template version, and lead/plan ownership). A raw
// GET, prefetch, scanner, provider open, or provider click never reaches here.
import {
  HALFWAY_JOB_TYPE,
  HALFWAY_JOB_VERSION,
  HALFWAY_TEMPLATE_VERSION,
} from "@/lib/email/types";
import {
  OPEN_PLAN_TOKEN_PURPOSE,
  type ReturnTokenJobIdentity,
} from "@/lib/email/return-destination";

/** General exchange event, kept for Plan Ready, Start Day 1, and job-less tokens. */
export const PLAN_READY_LINK_EXCHANGE_EVENT = "email_plan_ready_link_exchange_completed";

/** Emitted only for a deliberate valid open_plan exchange of a Halfway job token. */
export const HALFWAY_LINK_EXCHANGE_EVENT = "email_halfway_link_exchange_completed";

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
 * Halfway is selected only when the token purpose is `open_plan` and the
 * originating job is a canonical `halfway` / `halfway_v1` job owned by the same
 * validated lead and plan version. Job-less tokens, Plan Ready jobs, Start Day 1
 * jobs, mismatched ownership or version, mismatched template version, and
 * recovery-purpose tokens all keep the general event.
 */
export function resolveLinkExchangeEvent(input: LinkExchangeEventInput): string {
  return resolveLinkExchangeAttribution(input).eventName;
}

/**
 * Trusted attribution for a completed exchange: the canonical event name and,
 * for Halfway only, the originating job id. The job id is an internal
 * identifier, so including it keeps the no-PII event boundary intact.
 */
export function resolveLinkExchangeAttribution(input: LinkExchangeEventInput): {
  eventName: string;
  jobId: string | null;
} {
  const general = { eventName: PLAN_READY_LINK_EXCHANGE_EVENT, jobId: null };
  if (input.purpose !== OPEN_PLAN_TOKEN_PURPOSE) return general;

  const job = input.job;
  if (!job) return general;
  if (job.jobType !== HALFWAY_JOB_TYPE) return general;
  if (job.jobVersion !== HALFWAY_JOB_VERSION) return general;
  if (job.templateVersion !== HALFWAY_TEMPLATE_VERSION) return general;
  if (!job.leadPlanId || job.leadPlanId !== input.leadPlanId) return general;
  if (!job.planVersionId || job.planVersionId !== input.planVersionId) return general;
  if (!job.jobId) return general;

  return { eventName: HALFWAY_LINK_EXCHANGE_EVENT, jobId: job.jobId };
}
