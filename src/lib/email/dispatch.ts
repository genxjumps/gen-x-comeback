// Durable lifecycle email dispatcher. Deterministic and injectable: no
// environment reads, no direct database access, no provider imports.
import {
  HALFWAY_JOB_TYPE,
  IDEMPOTENCY_HORIZON_MS,
  MAX_ATTEMPTS,
  PLAN_READY_JOB_TYPE,
  RETRY_DELAYS_MS,
  RETURN_TOKEN_TTL_MS,
  START_DAY_1_JOB_TYPE,
  STALE_PENDING_MS,
  type EmailAdapter,
  type EmailJobRow,
  type EmailJobStatus,
  type EmailSendRequest,
  type LeadRow,
} from "@/lib/email/types";
import type { EmailJobPatch, EmailStore } from "@/lib/email/store";
import { lifecycleEventName, type LifecycleEventOutcome } from "@/lib/email/event-names";
import { renderPlanReady } from "@/lib/email/plan-ready-template";
import { renderStartDayOne } from "@/lib/email/start-day-1-template";
import { renderHalfway } from "@/lib/email/halfway-template";
import {
  resolveHalfway,
  type HalfwayJob,
  type HalfwayState,
} from "@/lib/email/halfway-resolver";
import {
  resolveStartDayOne,
  type StartDayOneJob,
  type StartDayOneState,
} from "@/lib/email/start-day-1-resolver";

export type DispatchDeps = {
  store: EmailStore;
  adapter: EmailAdapter;
  now: () => Date;
  appOrigin: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  /**
   * Stable per-plan-version credential derivation. Retrying one job must yield
   * the identical return and preference links, never a second live credential.
   */
  deriveCredential: (purpose: "open_plan" | "email_preferences", planVersionId: string) => string;
  hash: (raw: string) => Promise<string>;
};

/** Start Day 1 additionally needs the authoritative read-only state loader. */
export type StartDayOneDispatchDeps = DispatchDeps & {
  loadStartDayOneState: (job: StartDayOneJob) => Promise<StartDayOneState>;
};

/** Halfway additionally needs its authoritative read-only state loader. */
export type HalfwayDispatchDeps = DispatchDeps & {
  loadHalfwayState: (job: HalfwayJob) => Promise<HalfwayState>;
};

export type JobOutcome =
  | "provider_accepted"
  | "retry_scheduled"
  | "failed_permanent"
  | "suppressed"
  | "canceled"
  | "manual_review"
  | "deferred"
  | "lost_lease";

export type DispatchSummary = {
  claimed: number;
  outcomes: Array<{ jobId: string; outcome: JobOutcome; errorCode?: string }>;
};

function returnUrl(appOrigin: string, token: string): string {
  return `${appOrigin}/return?token=${token}`;
}

function preferencesUrl(appOrigin: string, token: string): string {
  return `${appOrigin}/email-preferences?c=${token}`;
}

type TerminalOutcome = Exclude<JobOutcome, "lost_lease">;

const OUTCOME_STATUS: Record<TerminalOutcome, EmailJobStatus> = {
  provider_accepted: "provider_accepted",
  retry_scheduled: "retry_scheduled",
  failed_permanent: "failed_permanent",
  suppressed: "suppressed",
  canceled: "canceled",
  // A manual-review job is not retried; it is parked as a permanent failure.
  manual_review: "failed_permanent",
  // A deferral keeps the job claimable at the resolver-approved time.
  deferred: "retry_scheduled",
};

const OUTCOME_EVENT: Record<TerminalOutcome, LifecycleEventOutcome | null> = {
  provider_accepted: "provider_accepted",
  retry_scheduled: "retry_scheduled",
  failed_permanent: "failed_permanent",
  suppressed: "suppressed",
  canceled: "canceled",
  manual_review: "manual_review",
  // Not a real transient retry: emitting one would be a false event.
  deferred: null,
};

type FinishExtra = {
  errorCode?: string;
  providerKey?: string;
  providerMessageId?: string;
  acceptedAt?: string;
  reason?: string;
  attemptedAt?: string;
  /** Resolver-approved next eligibility time for a deferral. */
  eligibleAt?: string;
};

/**
 * Applies one fenced terminal transition. A lost lease means another worker
 * already owns this job, so no state, event, or alert is written here.
 */
async function finish(
  deps: DispatchDeps,
  job: EmailJobRow,
  outcome: TerminalOutcome,
  extra: FinishExtra,
): Promise<{ jobId: string; outcome: JobOutcome; errorCode?: string }> {
  const nowIso = deps.now().toISOString();
  const status = OUTCOME_STATUS[outcome];
  const eventOutcome = OUTCOME_EVENT[outcome];
  const eventName = eventOutcome ? lifecycleEventName(job.job_type, eventOutcome) : null;
  const patch: EmailJobPatch = {};

  if (extra.attemptedAt) patch.first_provider_attempt_at = extra.attemptedAt;

  if (outcome === "provider_accepted") {
    patch.provider_key = extra.providerKey ?? deps.adapter.key;
    patch.provider_message_id = extra.providerMessageId ?? null;
    patch.provider_accepted_at = extra.acceptedAt ?? nowIso;
    patch.next_attempt_at = null;
  } else if (outcome === "retry_scheduled") {
    const delay = RETRY_DELAYS_MS[Math.min(job.attempt_count - 1, RETRY_DELAYS_MS.length - 1)]!;
    patch.next_attempt_at = new Date(deps.now().getTime() + delay).toISOString();
    patch.last_error_code = extra.errorCode ?? null;
    patch.last_error_at = nowIso;
  } else if (outcome === "deferred") {
    patch.next_attempt_at = extra.eligibleAt ?? nowIso;
  } else if (outcome === "failed_permanent" || outcome === "manual_review") {
    patch.next_attempt_at = null;
    patch.last_error_code = extra.errorCode ?? null;
    patch.last_error_at = nowIso;
    if (outcome === "manual_review") patch.manual_review_at = nowIso;
  } else if (outcome === "suppressed") {
    patch.next_attempt_at = null;
    patch.suppression_reason = extra.reason ?? null;
  } else {
    patch.next_attempt_at = null;
    patch.canceled_at = nowIso;
  }

  const fenced = await deps.store.finishJob(job.job_id, job.claim_token, status, patch, eventName);
  if (!fenced) return { jobId: job.job_id, outcome: "lost_lease" };

  if (outcome === "failed_permanent") {
    await deps.store.recordAlert({
      alert_type: `${job.job_type}_failed_permanent`,
      severity: "critical",
      job_id: job.job_id,
      lead_plan_id: job.lead_plan_id,
      details: { attempt_count: job.attempt_count, error_code: extra.errorCode ?? null },
    });
  } else if (outcome === "manual_review") {
    await deps.store.recordAlert({
      alert_type: `${job.job_type}_manual_review_required`,
      severity: "critical",
      job_id: job.job_id,
      lead_plan_id: job.lead_plan_id,
      details: {
        reason: "idempotency_horizon_exceeded",
        created_at: job.created_at,
        attempt_count: job.attempt_count,
      },
    });
  }

  if (outcome === "provider_accepted" && patch.provider_message_id) {
    // A delivery or bounce webhook can legitimately arrive before this row knew
    // its provider message id; apply anything already waiting.
    await deps.store.reconcileProviderEvents({
      jobId: job.job_id,
      providerKey: patch.provider_key ?? deps.adapter.key,
      providerMessageId: patch.provider_message_id,
    });
  }

  return extra.errorCode
    ? { jobId: job.job_id, outcome, errorCode: extra.errorCode }
    : { jobId: job.job_id, outcome };
}

/** Shared guards that apply to every lifecycle job before a provider attempt. */
async function guardCommon(
  deps: DispatchDeps,
  job: EmailJobRow,
): Promise<{ jobId: string; outcome: JobOutcome; errorCode?: string } | null> {
  if (job.attempt_count > MAX_ATTEMPTS) {
    return finish(deps, job, "failed_permanent", { errorCode: "max_attempts_exceeded" });
  }

  // Past the provider's idempotency horizon a fresh attempt could duplicate a
  // send that already happened. A human decides instead. The horizon runs from
  // when the job first became attemptable, so a deliberately delayed job (Start
  // Day 1 waits 24 hours) is not parked for its own scheduled delay. Plan Ready
  // is unaffected: its eligibility equals its creation time.
  const horizonFrom = Math.max(
    new Date(job.created_at).getTime(),
    new Date(job.eligible_at).getTime(),
  );
  if (deps.now().getTime() - horizonFrom > IDEMPOTENCY_HORIZON_MS) {
    return finish(deps, job, "manual_review", { errorCode: "idempotency_horizon_exceeded" });
  }

  return null;
}

/** Issues the approved opaque credentials and returns their absolute URLs. */
async function issueCredentials(
  deps: DispatchDeps,
  job: EmailJobRow,
  lead: LeadRow,
  associateJob: boolean,
): Promise<{ returnUrl: string; preferencesUrl: string }> {
  const issuedAt = deps.now();
  const rawReturnToken = deps.deriveCredential("open_plan", lead.plan_version_id);
  const rawPreferencesToken = deps.deriveCredential("email_preferences", lead.plan_version_id);

  await deps.store.insertReturnToken({
    leadPlanId: lead.id,
    planVersionId: lead.plan_version_id,
    tokenHash: await deps.hash(rawReturnToken),
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + RETURN_TOKEN_TTL_MS).toISOString(),
    ...(associateJob ? { jobId: job.job_id } : {}),
  });
  await deps.store.upsertPreferenceCredential(lead.id, await deps.hash(rawPreferencesToken));

  return {
    returnUrl: returnUrl(deps.appOrigin, rawReturnToken),
    preferencesUrl: preferencesUrl(deps.appOrigin, rawPreferencesToken),
  };
}

/** Performs exactly one provider attempt and applies the resulting transition. */
async function attemptSend(
  deps: DispatchDeps,
  job: EmailJobRow,
  request: EmailSendRequest,
): Promise<{ jobId: string; outcome: JobOutcome; errorCode?: string }> {
  const attemptedAt = deps.now().toISOString();
  const result = await deps.adapter.send(request);

  if (result.outcome === "accepted") {
    return finish(deps, job, "provider_accepted", {
      providerKey: result.providerKey,
      providerMessageId: result.providerMessageId,
      acceptedAt: result.acceptedAt,
      attemptedAt,
    });
  }

  if (result.outcome === "ambiguous") {
    // The provider may already hold this exact idempotency key.
    const reconciled = deps.adapter.lookupByIdempotencyKey
      ? await deps.adapter.lookupByIdempotencyKey(job.idempotency_key)
      : null;
    if (reconciled) {
      return finish(deps, job, "provider_accepted", {
        providerKey: deps.adapter.key,
        providerMessageId: reconciled.providerMessageId,
        acceptedAt: reconciled.acceptedAt,
        attemptedAt,
      });
    }
  }

  if (result.outcome === "permanent") {
    return finish(deps, job, "failed_permanent", { errorCode: result.errorCode, attemptedAt });
  }

  // Transient or unreconciled ambiguous failure.
  if (job.attempt_count >= MAX_ATTEMPTS) {
    return finish(deps, job, "failed_permanent", { errorCode: result.errorCode, attemptedAt });
  }
  return finish(deps, job, "retry_scheduled", { errorCode: result.errorCode, attemptedAt });
}

/** Claims due Plan Ready jobs, rechecks eligibility, and performs one attempt each. */
export async function dispatchPlanReadyJobs(
  deps: DispatchDeps,
  options?: { limit?: number; leaseSeconds?: number },
): Promise<DispatchSummary> {
  const jobs = await deps.store.claimJobs(
    PLAN_READY_JOB_TYPE,
    options?.limit ?? 10,
    options?.leaseSeconds ?? 120,
  );
  const outcomes: DispatchSummary["outcomes"] = [];

  for (const job of jobs) {
    const lead = await deps.store.getLead(job.lead_plan_id);

    // The job must still represent the current plan version.
    if (!lead || lead.plan_version_id !== job.plan_version_id) {
      outcomes.push(await finish(deps, job, "canceled", {}));
      continue;
    }

    // Hard bounce or complaint blocks unsafe sending; access is retained.
    const suppression =
      lead.email_suppression_reason ?? (await deps.store.suppressionReason(lead.email_normalized));
    if (suppression) {
      outcomes.push(await finish(deps, job, "suppressed", { reason: suppression }));
      continue;
    }

    const guarded = await guardCommon(deps, job);
    if (guarded) {
      outcomes.push(guarded);
      continue;
    }

    const urls = await issueCredentials(deps, job, lead, false);
    const rendered = renderPlanReady({
      firstName: lead.first_name,
      returnUrl: urls.returnUrl,
      preferencesUrl: urls.preferencesUrl,
    });

    outcomes.push(
      await attemptSend(deps, job, {
        to: lead.email_original,
        fromEmail: deps.fromEmail,
        fromName: deps.fromName,
        replyTo: deps.replyTo,
        subject: rendered.subject,
        previewText: rendered.previewText,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: job.idempotency_key,
        correlationId: job.job_id,
        disableClickTracking: true,
      }),
    );
  }

  return { claimed: jobs.length, outcomes };
}

/**
 * Claims due Start Day 1 jobs and, immediately before each provider attempt,
 * re-resolves authoritative state. A CANCEL resolution never renders, never
 * derives a credential, never builds a payload, and never calls the provider.
 */
export async function dispatchStartDayOneJobs(
  deps: StartDayOneDispatchDeps,
  options?: { limit?: number; leaseSeconds?: number },
): Promise<DispatchSummary> {
  const jobs = await deps.store.claimJobs(
    START_DAY_1_JOB_TYPE,
    options?.limit ?? 10,
    options?.leaseSeconds ?? 120,
  );
  const outcomes: DispatchSummary["outcomes"] = [];

  for (const job of jobs) {
    const state = await deps.loadStartDayOneState({
      job_id: job.job_id,
      job_type: job.job_type,
      job_version: job.job_version,
      template_version: job.template_version,
      lead_plan_id: job.lead_plan_id,
      plan_version_id: job.plan_version_id,
      eligible_at: job.eligible_at,
    });
    const resolution = resolveStartDayOne(state, deps.now());

    if (resolution.action === "CANCEL") {
      if (resolution.disposition === "defer") {
        outcomes.push(
          await finish(deps, job, "deferred", {
            ...(resolution.eligibleAt ? { eligibleAt: resolution.eligibleAt } : {}),
          }),
        );
      } else if (resolution.disposition === "suppress") {
        outcomes.push(await finish(deps, job, "suppressed", { reason: resolution.reason }));
      } else {
        outcomes.push(await finish(deps, job, "canceled", {}));
      }
      continue;
    }

    const lead = await deps.store.getLead(job.lead_plan_id);
    if (!lead || lead.plan_version_id !== job.plan_version_id) {
      outcomes.push(await finish(deps, job, "canceled", {}));
      continue;
    }

    const guarded = await guardCommon(deps, job);
    if (guarded) {
      outcomes.push(guarded);
      continue;
    }

    // The return token is associated with this job so the trusted destination
    // code recognizes start_day_1_v1 and opens Day 1.
    const urls = await issueCredentials(deps, job, lead, true);
    const rendered = renderStartDayOne(resolution, {
      firstName: lead.first_name,
      returnUrl: urls.returnUrl,
      preferencesUrl: urls.preferencesUrl,
    });
    if (!rendered) {
      outcomes.push(await finish(deps, job, "canceled", {}));
      continue;
    }

    outcomes.push(
      await attemptSend(deps, job, {
        to: lead.email_original,
        fromEmail: deps.fromEmail,
        fromName: deps.fromName,
        replyTo: deps.replyTo,
        subject: rendered.subject,
        previewText: rendered.previewText,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: job.idempotency_key,
        correlationId: job.job_id,
        disableClickTracking: true,
      }),
    );
  }

  return { claimed: jobs.length, outcomes };
}

/**
 * Claims due Halfway jobs and, immediately before each provider attempt,
 * re-resolves authoritative progress state. A CANCEL resolution never renders,
 * never derives a credential, never builds a payload, and never calls the
 * provider.
 *
 * Priority: this loop runs below Plan Completed and above Start Day 1, so the
 * shared 24-hour lifecycle gap is consumed by the higher-priority message first.
 */
export async function dispatchHalfwayJobs(
  deps: HalfwayDispatchDeps,
  options?: { limit?: number; leaseSeconds?: number },
): Promise<DispatchSummary> {
  const jobs = await deps.store.claimJobs(
    HALFWAY_JOB_TYPE,
    options?.limit ?? 10,
    options?.leaseSeconds ?? 120,
  );
  const outcomes: DispatchSummary["outcomes"] = [];

  for (const job of jobs) {
    const state = await deps.loadHalfwayState({
      job_id: job.job_id,
      job_type: job.job_type,
      job_version: job.job_version,
      template_version: job.template_version,
      lead_plan_id: job.lead_plan_id,
      plan_version_id: job.plan_version_id,
      eligible_at: job.eligible_at,
    });
    const resolution = resolveHalfway(state, deps.now());

    if (resolution.action === "CANCEL") {
      if (resolution.disposition === "defer") {
        outcomes.push(
          await finish(deps, job, "deferred", {
            ...(resolution.eligibleAt ? { eligibleAt: resolution.eligibleAt } : {}),
          }),
        );
      } else if (resolution.disposition === "suppress") {
        outcomes.push(await finish(deps, job, "suppressed", { reason: resolution.reason }));
      } else {
        outcomes.push(await finish(deps, job, "canceled", {}));
      }
      continue;
    }

    const lead = await deps.store.getLead(job.lead_plan_id);
    if (!lead || lead.plan_version_id !== job.plan_version_id) {
      outcomes.push(await finish(deps, job, "canceled", {}));
      continue;
    }

    const guarded = await guardCommon(deps, job);
    if (guarded) {
      outcomes.push(guarded);
      continue;
    }

    // The CTA reuses the ordinary open_plan credential, associated with this
    // Halfway job so a completed exchange can be attributed. Only the token hash
    // is ever stored. The trusted destination stays the general plan hub.
    const urls = await issueCredentials(deps, job, lead, true);
    const rendered = renderHalfway(resolution, {
      firstName: lead.first_name,
      returnUrl: urls.returnUrl,
      preferencesUrl: urls.preferencesUrl,
      appOrigin: deps.appOrigin,
    });
    if (!rendered) {
      outcomes.push(await finish(deps, job, "canceled", {}));
      continue;
    }

    outcomes.push(
      await attemptSend(deps, job, {
        to: lead.email_original,
        fromEmail: deps.fromEmail,
        fromName: deps.fromName,
        replyTo: deps.replyTo,
        subject: rendered.subject,
        previewText: rendered.previewText,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: job.idempotency_key,
        correlationId: job.job_id,
        disableClickTracking: true,
      }),
    );
  }

  return { claimed: jobs.length, outcomes };
}

/** Raises one operational alert per Plan Ready job still unsent after five minutes. */
export async function raiseStalePlanReadyAlerts(deps: DispatchDeps): Promise<number> {
  const cutoff = new Date(deps.now().getTime() - STALE_PENDING_MS).toISOString();
  return deps.store.raiseStaleAlerts(PLAN_READY_JOB_TYPE, cutoff);
}
