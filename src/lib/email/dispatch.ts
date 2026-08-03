// Durable Plan Ready dispatcher. Deterministic and injectable: no environment
// reads, no direct database access, no provider imports.
import {
  IDEMPOTENCY_HORIZON_MS,
  MAX_ATTEMPTS,
  PLAN_READY_JOB_TYPE,
  RETRY_DELAYS_MS,
  RETURN_TOKEN_TTL_MS,
  STALE_PENDING_MS,
  type EmailAdapter,
  type EmailJobRow,
  type EmailJobStatus,
} from "@/lib/email/types";
import type { EmailJobPatch, EmailStore } from "@/lib/email/store";
import { renderPlanReady } from "@/lib/email/plan-ready-template";

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

export type JobOutcome =
  | "provider_accepted"
  | "retry_scheduled"
  | "failed_permanent"
  | "suppressed"
  | "canceled"
  | "manual_review"
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

const OUTCOME_STATUS: Record<
  Exclude<JobOutcome, "lost_lease">,
  { status: EmailJobStatus; event: string | null }
> = {
  provider_accepted: {
    status: "provider_accepted",
    event: "email_plan_ready_provider_accepted",
  },
  retry_scheduled: { status: "retry_scheduled", event: "email_plan_ready_retry_scheduled" },
  failed_permanent: { status: "failed_permanent", event: "email_plan_ready_failed_permanent" },
  suppressed: { status: "suppressed", event: "email_plan_ready_suppressed" },
  canceled: { status: "canceled", event: null },
  manual_review: { status: "failed_permanent", event: "email_plan_ready_manual_review" },
};

type FinishExtra = {
  errorCode?: string;
  providerKey?: string;
  providerMessageId?: string;
  acceptedAt?: string;
  reason?: string;
  attemptedAt?: string;
};

/**
 * Applies one fenced terminal transition. A lost lease means another worker
 * already owns this job, so no state, event, or alert is written here.
 */
async function finish(
  deps: DispatchDeps,
  job: EmailJobRow,
  outcome: Exclude<JobOutcome, "lost_lease">,
  extra: FinishExtra,
): Promise<{ jobId: string; outcome: JobOutcome; errorCode?: string }> {
  const nowIso = deps.now().toISOString();
  const mapped = OUTCOME_STATUS[outcome];
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

  const fenced = await deps.store.finishJob(
    job.job_id,
    job.claim_token,
    mapped.status,
    patch,
    mapped.event,
  );
  if (!fenced) return { jobId: job.job_id, outcome: "lost_lease" };

  if (outcome === "failed_permanent") {
    await deps.store.recordAlert({
      alert_type: "plan_ready_failed_permanent",
      severity: "critical",
      job_id: job.job_id,
      lead_plan_id: job.lead_plan_id,
      details: { attempt_count: job.attempt_count, error_code: extra.errorCode ?? null },
    });
  } else if (outcome === "manual_review") {
    await deps.store.recordAlert({
      alert_type: "plan_ready_manual_review_required",
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

    if (job.attempt_count > MAX_ATTEMPTS) {
      outcomes.push(
        await finish(deps, job, "failed_permanent", { errorCode: "max_attempts_exceeded" }),
      );
      continue;
    }

    // Past the provider's idempotency horizon a fresh attempt could duplicate a
    // send that already happened. A human decides instead.
    if (deps.now().getTime() - new Date(job.created_at).getTime() > IDEMPOTENCY_HORIZON_MS) {
      outcomes.push(
        await finish(deps, job, "manual_review", { errorCode: "idempotency_horizon_exceeded" }),
      );
      continue;
    }

    const issuedAt = deps.now();
    const rawReturnToken = deps.deriveCredential("open_plan", lead.plan_version_id);
    const rawPreferencesToken = deps.deriveCredential("email_preferences", lead.plan_version_id);
    await deps.store.insertReturnToken({
      leadPlanId: lead.id,
      planVersionId: lead.plan_version_id,
      tokenHash: await deps.hash(rawReturnToken),
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + RETURN_TOKEN_TTL_MS).toISOString(),
    });
    await deps.store.upsertPreferenceCredential(lead.id, await deps.hash(rawPreferencesToken));

    const rendered = renderPlanReady({
      firstName: lead.first_name,
      returnUrl: returnUrl(deps.appOrigin, rawReturnToken),
      preferencesUrl: preferencesUrl(deps.appOrigin, rawPreferencesToken),
    });

    const attemptedAt = deps.now().toISOString();
    const result = await deps.adapter.send({
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
    });

    if (result.outcome === "accepted") {
      outcomes.push(
        await finish(deps, job, "provider_accepted", {
          providerKey: result.providerKey,
          providerMessageId: result.providerMessageId,
          acceptedAt: result.acceptedAt,
          attemptedAt,
        }),
      );
      continue;
    }

    if (result.outcome === "ambiguous") {
      // The provider may already hold this exact idempotency key.
      const reconciled = deps.adapter.lookupByIdempotencyKey
        ? await deps.adapter.lookupByIdempotencyKey(job.idempotency_key)
        : null;
      if (reconciled) {
        outcomes.push(
          await finish(deps, job, "provider_accepted", {
            providerKey: deps.adapter.key,
            providerMessageId: reconciled.providerMessageId,
            acceptedAt: reconciled.acceptedAt,
            attemptedAt,
          }),
        );
        continue;
      }
    }

    if (result.outcome === "permanent") {
      outcomes.push(
        await finish(deps, job, "failed_permanent", { errorCode: result.errorCode, attemptedAt }),
      );
      continue;
    }

    // Transient or unreconciled ambiguous failure.
    if (job.attempt_count >= MAX_ATTEMPTS) {
      outcomes.push(
        await finish(deps, job, "failed_permanent", { errorCode: result.errorCode, attemptedAt }),
      );
    } else {
      outcomes.push(
        await finish(deps, job, "retry_scheduled", { errorCode: result.errorCode, attemptedAt }),
      );
    }
  }

  return { claimed: jobs.length, outcomes };
}

/** Raises one operational alert per Plan Ready job still unsent after five minutes. */
export async function raiseStalePlanReadyAlerts(deps: DispatchDeps): Promise<number> {
  const cutoff = new Date(deps.now().getTime() - STALE_PENDING_MS).toISOString();
  return deps.store.raiseStaleAlerts(PLAN_READY_JOB_TYPE, cutoff);
}
