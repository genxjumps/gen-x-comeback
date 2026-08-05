// Client-safe shared types for the versioned lifecycle email pipeline.

export const PLAN_READY_JOB_TYPE = "plan_ready";
export const PLAN_READY_JOB_VERSION = "v1";
export const PLAN_READY_TEMPLATE_VERSION = "plan_ready_v1";

export const START_DAY_1_JOB_TYPE = "start_day_1";
export const START_DAY_1_JOB_VERSION = "v1";
export const START_DAY_1_TEMPLATE_VERSION = "start_day_1_v1";
export const START_DAY_1_ELIGIBILITY_DELAY_MS = 24 * 60 * 60 * 1000;

export const HALFWAY_JOB_TYPE = "halfway";
export const HALFWAY_JOB_VERSION = "v1";
export const HALFWAY_TEMPLATE_VERSION = "halfway_v1";

/** The Halfway job is created on the transition to this many completions. */
export const HALFWAY_TRIGGER_COMPLETIONS = 4;

/** Inclusive required-completion window in which Halfway is still sendable. */
export const HALFWAY_MIN_COMPLETIONS = 4;
export const HALFWAY_MAX_COMPLETIONS = 6;

/**
 * Plan Completed is the highest-priority lifecycle message. It is not yet
 * implemented, but its job type is named here so Halfway can always yield to it.
 */
export const PLAN_COMPLETED_JOB_TYPE = "plan_completed";

/** Contract retry schedule: delays after each preceding transient failure. */
export const RETRY_DELAYS_MS = [
  60_000, // 1 minute
  300_000, // 5 minutes
  1_800_000, // 30 minutes
  7_200_000, // 2 hours
  43_200_000, // 12 hours
] as const;

/** Initial attempt plus five retries. */
export const MAX_ATTEMPTS = 6;

/** Return tokens are reusable for 30 days from issuance. */
export const RETURN_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A completed exchange session lasts as long as the token that created it. */
export const RETURN_SESSION_TTL_MS = RETURN_TOKEN_TTL_MS;

/**
 * Provider idempotency keys are only honored for a bounded period. Past this
 * horizon a stalled job must not be retried blindly: it goes to manual review.
 */
export const IDEMPOTENCY_HORIZON_MS = 24 * 60 * 60 * 1000;

/** A pending job older than five minutes raises an operational alert. */
export const STALE_PENDING_MS = 5 * 60 * 1000;

export const RETURN_SESSION_COOKIE = "return_link_session";

export type EmailJobStatus =
  | "pending"
  | "processing"
  | "retry_scheduled"
  | "provider_accepted"
  | "failed_permanent"
  | "suppressed"
  | "canceled";

export type EmailDeliveryStatus = "pending" | "delivered" | "delayed" | "bounced" | "complained";

export type EmailJobRow = {
  job_id: string;
  job_type: string;
  job_version: string;
  template_version: string;
  lead_plan_id: string;
  plan_version_id: string;
  source_event_id: string | null;
  idempotency_key: string;
  /** Earliest time this job may be attempted (plan creation plus any delay). */
  eligible_at: string;
  status: EmailJobStatus;
  delivery_status: EmailDeliveryStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  locked_at: string | null;
  lease_expires_at: string | null;
  /** Lease fencing token issued by the claim RPC. Required to finish the job. */
  claim_token: string | null;
  first_provider_attempt_at: string | null;
  manual_review_at: string | null;
  provider_key: string | null;
  provider_message_id: string | null;
  created_at: string;
};

export type LeadRow = {
  id: string;
  plan_version_id: string;
  first_name: string;
  email_original: string;
  email_normalized: string;
  email_suppressed_at: string | null;
  email_suppression_reason: string | null;
};

export type CanonicalEventInput = {
  event_name: string;
  lead_plan_id?: string | null;
  plan_version_id?: string | null;
  submission_id?: string | null;
  job_id?: string | null;
  source?: string | null;
  occurred_at?: string;
};

export type OperationalAlertInput = {
  alert_type: string;
  severity?: "info" | "warning" | "critical";
  job_id?: string | null;
  lead_plan_id?: string | null;
  details?: Record<string, string | number | boolean | null>;
};

/**
 * Provider-neutral send request. Only contract-approved fields are present:
 * no normalized-email key, assessment, weight, protein, plan, or progress data.
 */
export type EmailSendRequest = {
  to: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  subject: string;
  previewText: string;
  html: string;
  text: string;
  idempotencyKey: string;
  /** Opaque correlation id (the job id). Never a database row of user data. */
  correlationId: string;
  /** Provider click tracking must stay disabled for the secure CTA. */
  disableClickTracking: true;
};

export type EmailSendResult =
  | { outcome: "accepted"; providerKey: string; providerMessageId: string; acceptedAt: string }
  | { outcome: "transient"; errorCode: string }
  | { outcome: "permanent"; errorCode: string }
  | { outcome: "ambiguous"; errorCode: string };

export type EmailAdapter = {
  key: string;
  send: (request: EmailSendRequest) => Promise<EmailSendResult>;
  /** Reconciliation path for ambiguous timeouts using the stable idempotency key. */
  lookupByIdempotencyKey?: (
    idempotencyKey: string,
  ) => Promise<{ providerMessageId: string; acceptedAt: string } | null>;
};
