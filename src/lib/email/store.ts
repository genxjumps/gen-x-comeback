// Storage boundary for the email pipeline. The dispatcher depends on this
// interface only, so tests can run against a deterministic in-memory store.
import type {
  CanonicalEventInput,
  EmailDeliveryStatus,
  EmailJobRow,
  EmailJobStatus,
  LeadRow,
  OperationalAlertInput,
} from "@/lib/email/types";

/**
 * Fields a fenced terminal transition may set. Status, lease release, and the
 * claim-token check are handled by the transition itself.
 */
export type EmailJobPatch = {
  next_attempt_at?: string | null;
  provider_key?: string | null;
  provider_message_id?: string | null;
  provider_accepted_at?: string | null;
  last_error_code?: string | null;
  last_error_at?: string | null;
  suppression_reason?: string | null;
  canceled_at?: string | null;
  manual_review_at?: string | null;
  first_provider_attempt_at?: string | null;
};

export type ReturnTokenInsert = {
  leadPlanId: string;
  planVersionId: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  /**
   * Originating email job. Persisted so the trusted return-destination code can
   * recognize a start_day_1_v1 token. Absent for general plan-access tokens.
   */
  jobId?: string;
};

export type EmailStore = {
  claimJobs(jobType: string, limit: number, leaseSeconds: number): Promise<EmailJobRow[]>;
  getLead(leadPlanId: string): Promise<LeadRow | null>;
  suppressionReason(emailNormalized: string): Promise<string | null>;
  insertReturnToken(token: ReturnTokenInsert): Promise<void>;
  upsertPreferenceCredential(leadPlanId: string, tokenHash: string): Promise<void>;
  /**
   * Fenced terminal transition. Returns false when the claim token no longer
   * matches, meaning another worker owns the job and this result is discarded.
   */
  finishJob(
    jobId: string,
    claimToken: string | null,
    status: EmailJobStatus,
    patch: EmailJobPatch,
    eventName?: string | null,
  ): Promise<boolean>;
  /**
   * Fenced deferral transition used only by a Halfway DEFER. A deferral is not
   * a provider attempt, so it restores the pre-claim attempt count, releases the
   * lease, schedules the resolver-approved next attempt time, and emits no
   * event. Returns false when the claim token no longer matches (lost lease).
   */
  deferJob(
    jobId: string,
    claimToken: string | null,
    nextAttemptAt: string,
    restoredAttemptCount: number,
  ): Promise<boolean>;
  /** Transactional, rank-guarded delivery transition. */
  applyDeliveryEvent(
    jobId: string,
    kind: EmailDeliveryStatus,
    occurredAt: string | null,
  ): Promise<boolean>;
  /** Applies provider events that arrived before the job knew its message id. */
  reconcileProviderEvents(input: {
    jobId: string;
    providerKey: string;
    providerMessageId: string;
  }): Promise<number>;
  recordEvent(event: CanonicalEventInput): Promise<void>;
  recordAlert(alert: OperationalAlertInput): Promise<void>;
  /** Raises one stale alert per overdue job, atomically marking it alerted. */
  raiseStaleAlerts(jobType: string, createdBeforeIso: string): Promise<number>;
};
