import { deriveEmailCredential } from "@/lib/email/credentials.server";
import {
  IDEMPOTENCY_HORIZON_MS,
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  RETURN_TOKEN_TTL_MS,
  type EmailAdapter,
  type EmailJobStatus,
  type EmailSendRequest,
} from "@/lib/email/types";
import {
  PAID_PURCHASE_ACCESS_JOB_TYPE,
  PAID_RECOVERY_JOB_TYPE,
  renderPaidAccessEmail,
} from "@/lib/email/paid-access-template";
import type { PaidAccessStore } from "@/lib/email/paid-access-store.server";
import type { PaidAccessJobPatch, PaidAccessJobRow } from "@/lib/email/paid-access-types";

export type PaidAccessDispatchDeps = {
  store: PaidAccessStore;
  adapter: EmailAdapter;
  now: () => Date;
  appOrigin: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  tokenSecret: string;
  hash: (value: string) => Promise<string>;
};

export type PaidAccessDispatchOutcome =
  | "provider_accepted"
  | "retry_scheduled"
  | "failed_permanent"
  | "suppressed"
  | "canceled"
  | "manual_review"
  | "deferred"
  | "lost_lease";

export type PaidAccessDispatchSummary = {
  claimed: number;
  outcomes: Array<{ jobId: string; outcome: PaidAccessDispatchOutcome; errorCode?: string }>;
};

type TerminalOutcome = Exclude<PaidAccessDispatchOutcome, "deferred" | "lost_lease">;

const statusFor: Record<TerminalOutcome, EmailJobStatus> = {
  provider_accepted: "provider_accepted",
  retry_scheduled: "retry_scheduled",
  failed_permanent: "failed_permanent",
  suppressed: "suppressed",
  canceled: "canceled",
  manual_review: "failed_permanent",
};

function eventName(job: PaidAccessJobRow, outcome: TerminalOutcome): string {
  return `${job.job_type}_${outcome}`;
}

async function finish(
  deps: PaidAccessDispatchDeps,
  job: PaidAccessJobRow,
  outcome: TerminalOutcome,
  extra?: {
    errorCode?: string;
    providerKey?: string;
    providerMessageId?: string;
    acceptedAt?: string;
    suppressionReason?: string;
  },
): Promise<{ jobId: string; outcome: PaidAccessDispatchOutcome; errorCode?: string }> {
  const nowIso = deps.now().toISOString();
  const patch: PaidAccessJobPatch = {};
  if (outcome === "provider_accepted") {
    patch.next_attempt_at = null;
    patch.provider_key = extra?.providerKey ?? deps.adapter.key;
    patch.provider_message_id = extra?.providerMessageId ?? null;
    patch.provider_accepted_at = extra?.acceptedAt ?? nowIso;
  } else if (outcome === "retry_scheduled") {
    const delay = RETRY_DELAYS_MS[Math.min(job.attempt_count - 1, RETRY_DELAYS_MS.length - 1)]!;
    patch.next_attempt_at = new Date(deps.now().getTime() + delay).toISOString();
    patch.last_error_code = extra?.errorCode ?? null;
    patch.last_error_at = nowIso;
  } else if (outcome === "failed_permanent" || outcome === "manual_review") {
    patch.next_attempt_at = null;
    patch.last_error_code = extra?.errorCode ?? null;
    patch.last_error_at = nowIso;
    if (outcome === "manual_review") patch.manual_review_at = nowIso;
  } else if (outcome === "suppressed") {
    patch.next_attempt_at = null;
    patch.suppression_reason = extra?.suppressionReason ?? "hard_bounce_or_complaint";
  } else {
    patch.next_attempt_at = null;
    patch.canceled_at = nowIso;
  }

  const fenced = await deps.store.finishJob(
    job,
    statusFor[outcome],
    patch,
    eventName(job, outcome),
  );
  if (!fenced) return { jobId: job.job_id, outcome: "lost_lease" };
  if (outcome === "provider_accepted" && patch.provider_message_id) {
    await deps.store.reconcileProviderEvents(
      job.job_id,
      patch.provider_key ?? deps.adapter.key,
      patch.provider_message_id,
    );
  }
  return extra?.errorCode
    ? { jobId: job.job_id, outcome, errorCode: extra.errorCode }
    : { jobId: job.job_id, outcome };
}

async function guardJob(
  deps: PaidAccessDispatchDeps,
  job: PaidAccessJobRow,
): Promise<{ jobId: string; outcome: PaidAccessDispatchOutcome; errorCode?: string } | null> {
  if (job.attempt_count > MAX_ATTEMPTS) {
    return finish(deps, job, "failed_permanent", { errorCode: "max_attempts_exceeded" });
  }
  const horizonFrom = job.first_provider_attempt_at
    ? new Date(job.first_provider_attempt_at).getTime()
    : Math.max(
        new Date(job.created_at).getTime(),
        new Date(job.eligible_at).getTime(),
        job.next_attempt_at ? new Date(job.next_attempt_at).getTime() : 0,
      );
  if (deps.now().getTime() - horizonFrom > IDEMPOTENCY_HORIZON_MS) {
    return finish(deps, job, "manual_review", {
      errorCode: "idempotency_horizon_exceeded",
    });
  }
  return null;
}

async function defer(
  deps: PaidAccessDispatchDeps,
  job: PaidAccessJobRow,
): Promise<{ jobId: string; outcome: PaidAccessDispatchOutcome }> {
  const nextAttemptAt = new Date(deps.now().getTime() + 5 * 60_000).toISOString();
  const fenced = await deps.store.deferJob(job, nextAttemptAt);
  return { jobId: job.job_id, outcome: fenced ? "deferred" : "lost_lease" };
}

async function sendOne(
  deps: PaidAccessDispatchDeps,
  job: PaidAccessJobRow,
): Promise<{ jobId: string; outcome: PaidAccessDispatchOutcome; errorCode?: string }> {
  const guarded = await guardJob(deps, job);
  if (guarded) return guarded;

  const customer = await deps.store.getCustomer(job.customer_id);
  if (!customer || !(await deps.store.entitlementIsActive(job.customer_id, job.entitlement_id))) {
    return finish(deps, job, "canceled");
  }
  const suppression = await deps.store.suppressionReason(customer.email_normalized);
  if (suppression) return finish(deps, job, "suppressed", { suppressionReason: suppression });

  const issuedAt = deps.now();
  const rawToken = deriveEmailCredential(
    deps.tokenSecret,
    "recovery",
    job.entitlement_id,
    job.idempotency_key,
  );
  await deps.store.upsertToken({
    customerId: job.customer_id,
    entitlementId: job.entitlement_id,
    jobId: job.job_id,
    tokenHash: await deps.hash(rawToken),
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + RETURN_TOKEN_TTL_MS).toISOString(),
  });

  const returnUrl = `${deps.appOrigin}/account/return?token=${rawToken}`;
  const rendered = renderPaidAccessEmail({
    kind: job.job_type === PAID_PURCHASE_ACCESS_JOB_TYPE ? "purchase" : "recovery",
    returnUrl,
  });
  const request: EmailSendRequest = {
    to: customer.email_original,
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
  };

  const attemptedAt = deps.now().toISOString();
  const authorization = await deps.store.beginProviderAttempt(job, attemptedAt);
  if (
    authorization.outcome === "activation_blocked" ||
    authorization.outcome === "entitlement_blocked"
  ) {
    return finish(deps, job, "canceled");
  }
  if (authorization.outcome === "suppression_blocked") {
    return finish(deps, job, "suppressed", { suppressionReason: "production_suppression_fence" });
  }
  if (
    authorization.outcome === "limit_reached" ||
    authorization.outcome === "controlled_scope_blocked" ||
    authorization.outcome === "sending_disabled"
  ) {
    return defer(deps, job);
  }
  if (authorization.outcome !== "ok" || !authorization.submissionAttemptId) {
    return { jobId: job.job_id, outcome: "lost_lease" };
  }

  const result = await deps.adapter.send(request);
  if (result.outcome === "accepted") {
    const completed = await deps.store.completeProviderAttempt({
      submissionAttemptId: authorization.submissionAttemptId,
      outcome: "accepted",
      completedAt: deps.now().toISOString(),
      providerKey: result.providerKey,
      providerMessageId: result.providerMessageId,
      providerAcceptedAt: result.acceptedAt,
    });
    if (!completed) throw new Error("paid_access_provider_evidence_not_completed");
    return finish(deps, job, "provider_accepted", {
      providerKey: result.providerKey,
      providerMessageId: result.providerMessageId,
      acceptedAt: result.acceptedAt,
    });
  }

  if (result.outcome === "ambiguous") {
    const reconciled = deps.adapter.lookupByIdempotencyKey
      ? await deps.adapter.lookupByIdempotencyKey(job.idempotency_key)
      : null;
    if (reconciled) {
      const completed = await deps.store.completeProviderAttempt({
        submissionAttemptId: authorization.submissionAttemptId,
        outcome: "accepted",
        completedAt: deps.now().toISOString(),
        providerKey: deps.adapter.key,
        providerMessageId: reconciled.providerMessageId,
        providerAcceptedAt: reconciled.acceptedAt,
      });
      if (!completed) throw new Error("paid_access_provider_evidence_not_completed");
      return finish(deps, job, "provider_accepted", {
        providerKey: deps.adapter.key,
        providerMessageId: reconciled.providerMessageId,
        acceptedAt: reconciled.acceptedAt,
      });
    }
  }

  const completed = await deps.store.completeProviderAttempt({
    submissionAttemptId: authorization.submissionAttemptId,
    outcome: result.outcome === "ambiguous" ? "uncertain" : result.outcome,
    completedAt: deps.now().toISOString(),
    providerKey: deps.adapter.key,
    outcomeCode: result.errorCode,
  });
  if (!completed) throw new Error("paid_access_provider_evidence_not_completed");

  if (result.outcome === "permanent" || job.attempt_count >= MAX_ATTEMPTS) {
    return finish(deps, job, "failed_permanent", { errorCode: result.errorCode });
  }
  return finish(deps, job, "retry_scheduled", { errorCode: result.errorCode });
}

async function dispatchType(
  deps: PaidAccessDispatchDeps,
  jobType: typeof PAID_PURCHASE_ACCESS_JOB_TYPE | typeof PAID_RECOVERY_JOB_TYPE,
  limit: number,
): Promise<PaidAccessDispatchSummary> {
  const jobs = await deps.store.claimJobs(jobType, limit, 120);
  const outcomes: PaidAccessDispatchSummary["outcomes"] = [];
  for (const job of jobs) outcomes.push(await sendOne(deps, job));
  return { claimed: jobs.length, outcomes };
}

export async function dispatchPaidAccessJobs(
  deps: PaidAccessDispatchDeps,
  limit = 25,
): Promise<{ purchase: PaidAccessDispatchSummary; recovery: PaidAccessDispatchSummary }> {
  const recovery = await dispatchType(deps, PAID_RECOVERY_JOB_TYPE, limit);
  const purchase = await dispatchType(deps, PAID_PURCHASE_ACCESS_JOB_TYPE, limit);
  return { purchase, recovery };
}
