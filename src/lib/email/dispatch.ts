// Durable Plan Ready dispatcher. Deterministic and injectable: no environment
// reads, no direct database access, no provider imports.
import {
  MAX_ATTEMPTS,
  PLAN_READY_JOB_TYPE,
  RETRY_DELAYS_MS,
  RETURN_TOKEN_TTL_MS,
  STALE_PENDING_MS,
  type EmailAdapter,
  type EmailJobRow,
} from "@/lib/email/types";
import type { EmailStore } from "@/lib/email/store";
import { renderPlanReady } from "@/lib/email/plan-ready-template";

export type DispatchDeps = {
  store: EmailStore;
  adapter: EmailAdapter;
  now: () => Date;
  appOrigin: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  generateToken: () => string;
  hash: (raw: string) => Promise<string>;
};

export type JobOutcome =
  | "provider_accepted"
  | "retry_scheduled"
  | "failed_permanent"
  | "suppressed"
  | "canceled";

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

async function finish(
  deps: DispatchDeps,
  job: EmailJobRow,
  outcome: JobOutcome,
  extra: { errorCode?: string; providerKey?: string; providerMessageId?: string; acceptedAt?: string; reason?: string },
): Promise<{ jobId: string; outcome: JobOutcome; errorCode?: string }> {
  const nowIso = deps.now().toISOString();
  const base = { locked_at: null, lease_expires_at: null };

  if (outcome === "provider_accepted") {
    await deps.store.updateJob(job.job_id, {
      ...base,
      status: "provider_accepted",
      provider_key: extra.providerKey ?? deps.adapter.key,
      provider_message_id: extra.providerMessageId ?? null,
      provider_accepted_at: extra.acceptedAt ?? nowIso,
      next_attempt_at: null,
    });
    await deps.store.recordEvent({
      event_name: "email_plan_ready_provider_accepted",
      lead_plan_id: job.lead_plan_id,
      plan_version_id: job.plan_version_id,
      job_id: job.job_id,
      occurred_at: nowIso,
    });
  } else if (outcome === "retry_scheduled") {
    const delay = RETRY_DELAYS_MS[Math.min(job.attempt_count - 1, RETRY_DELAYS_MS.length - 1)];
    await deps.store.updateJob(job.job_id, {
      ...base,
      status: "retry_scheduled",
      next_attempt_at: new Date(deps.now().getTime() + delay).toISOString(),
      last_error_code: extra.errorCode ?? null,
      last_error_at: nowIso,
    });
    await deps.store.recordEvent({
      event_name: "email_plan_ready_retry_scheduled",
      lead_plan_id: job.lead_plan_id,
      plan_version_id: job.plan_version_id,
      job_id: job.job_id,
      occurred_at: nowIso,
    });
  } else if (outcome === "failed_permanent") {
    await deps.store.updateJob(job.job_id, {
      ...base,
      status: "failed_permanent",
      next_attempt_at: null,
      last_error_code: extra.errorCode ?? null,
      last_error_at: nowIso,
    });
    await deps.store.recordEvent({
      event_name: "email_plan_ready_failed_permanent",
      lead_plan_id: job.lead_plan_id,
      plan_version_id: job.plan_version_id,
      job_id: job.job_id,
      occurred_at: nowIso,
    });
    await deps.store.recordAlert({
      alert_type: "plan_ready_failed_permanent",
      severity: "critical",
      job_id: job.job_id,
      lead_plan_id: job.lead_plan_id,
      details: { attempt_count: job.attempt_count, error_code: extra.errorCode ?? null },
    });
  } else if (outcome === "suppressed") {
    await deps.store.updateJob(job.job_id, {
      ...base,
      status: "suppressed",
      next_attempt_at: null,
      suppression_reason: extra.reason ?? null,
    });
    await deps.store.recordEvent({
      event_name: "email_plan_ready_suppressed",
      lead_plan_id: job.lead_plan_id,
      plan_version_id: job.plan_version_id,
      job_id: job.job_id,
      occurred_at: nowIso,
    });
  } else {
    await deps.store.updateJob(job.job_id, {
      ...base,
      status: "canceled",
      canceled_at: nowIso,
      next_attempt_at: null,
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
    const suppression = lead.email_suppression_reason ?? (await deps.store.suppressionReason(lead.email_normalized));
    if (suppression) {
      outcomes.push(await finish(deps, job, "suppressed", { reason: suppression }));
      continue;
    }

    if (job.attempt_count > MAX_ATTEMPTS) {
      outcomes.push(await finish(deps, job, "failed_permanent", { errorCode: "max_attempts_exceeded" }));
      continue;
    }

    const issuedAt = deps.now();
    const rawReturnToken = deps.generateToken();
    const rawPreferencesToken = deps.generateToken();
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
          }),
        );
        continue;
      }
    }

    if (result.outcome === "permanent") {
      outcomes.push(await finish(deps, job, "failed_permanent", { errorCode: result.errorCode }));
      continue;
    }

    // Transient or unreconciled ambiguous failure.
    if (job.attempt_count >= MAX_ATTEMPTS) {
      outcomes.push(await finish(deps, job, "failed_permanent", { errorCode: result.errorCode }));
    } else {
      outcomes.push(await finish(deps, job, "retry_scheduled", { errorCode: result.errorCode }));
    }
  }

  return { claimed: jobs.length, outcomes };
}

/** Raises one operational alert per Plan Ready job still unsent after five minutes. */
export async function raiseStalePlanReadyAlerts(deps: DispatchDeps): Promise<number> {
  const cutoff = new Date(deps.now().getTime() - STALE_PENDING_MS).toISOString();
  const stale = await deps.store.listStaleJobs(PLAN_READY_JOB_TYPE, cutoff);
  for (const job of stale) {
    await deps.store.recordAlert({
      alert_type: "plan_ready_pending_too_long",
      severity: "warning",
      job_id: job.job_id,
      lead_plan_id: job.lead_plan_id,
      details: { created_at: job.created_at },
    });
    await deps.store.updateJob(job.job_id, { alerted_stale_at: deps.now().toISOString() });
  }
  return stale.length;
}
