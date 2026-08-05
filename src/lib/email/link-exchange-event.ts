// Trusted server-side canonical event selection for a completed /return token
// exchange. Pure and read-only: no IO, no environment reads, no client input.
//
// The event is chosen only from validated server-side state (token purpose plus
// the originating job's type, template version, and lead/plan ownership). A raw
// GET, prefetch, scanner, provider open, or provider click never reaches here.
import { HALFWAY_JOB_TYPE, HALFWAY_TEMPLATE_VERSION } from "@/lib/email/types";
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
  job?: ReturnTokenJobIdentity | null;
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
  if (input.purpose !== OPEN_PLAN_TOKEN_PURPOSE) return PLAN_READY_LINK_EXCHANGE_EVENT;

  const job = input.job;
  if (!job) return PLAN_READY_LINK_EXCHANGE_EVENT;
  if (job.jobType !== HALFWAY_JOB_TYPE) return PLAN_READY_LINK_EXCHANGE_EVENT;
  if (job.templateVersion !== HALFWAY_TEMPLATE_VERSION) return PLAN_READY_LINK_EXCHANGE_EVENT;
  if (!job.leadPlanId || job.leadPlanId !== input.leadPlanId) {
    return PLAN_READY_LINK_EXCHANGE_EVENT;
  }
  if (!job.planVersionId || job.planVersionId !== input.planVersionId) {
    return PLAN_READY_LINK_EXCHANGE_EVENT;
  }

  return HALFWAY_LINK_EXCHANGE_EVENT;
}
