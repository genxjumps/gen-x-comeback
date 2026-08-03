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

export type EmailJobPatch = {
  status?: EmailJobStatus;
  delivery_status?: EmailDeliveryStatus;
  next_attempt_at?: string | null;
  locked_at?: string | null;
  lease_expires_at?: string | null;
  provider_key?: string | null;
  provider_message_id?: string | null;
  last_error_code?: string | null;
  last_error_at?: string | null;
  provider_accepted_at?: string | null;
  delivered_at?: string | null;
  canceled_at?: string | null;
  suppression_reason?: string | null;
  alerted_stale_at?: string | null;
};

export type ReturnTokenInsert = {
  leadPlanId: string;
  planVersionId: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
};

export type EmailStore = {
  claimJobs(jobType: string, limit: number, leaseSeconds: number): Promise<EmailJobRow[]>;
  getLead(leadPlanId: string): Promise<LeadRow | null>;
  suppressionReason(emailNormalized: string): Promise<string | null>;
  insertReturnToken(token: ReturnTokenInsert): Promise<void>;
  upsertPreferenceCredential(leadPlanId: string, tokenHash: string): Promise<void>;
  updateJob(jobId: string, patch: EmailJobPatch): Promise<void>;
  recordEvent(event: CanonicalEventInput): Promise<void>;
  recordAlert(alert: OperationalAlertInput): Promise<void>;
  listStaleJobs(
    jobType: string,
    createdBeforeIso: string,
  ): Promise<Array<{ job_id: string; lead_plan_id: string; created_at: string }>>;
};
