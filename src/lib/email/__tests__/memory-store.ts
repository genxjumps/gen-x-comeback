// Deterministic in-memory EmailStore for acceptance tests. No database, no clock.
import type { EmailJobPatch, EmailStore, ReturnTokenInsert } from "@/lib/email/store";
import { deliveredEventName } from "@/lib/email/event-names";
import type {
  CanonicalEventInput,
  EmailDeliveryStatus,
  EmailJobRow,
  LeadRow,
  OperationalAlertInput,
} from "@/lib/email/types";

export type StoredJob = EmailJobRow &
  EmailJobPatch & {
    delivered_at?: string | null;
    alerted_stale_at?: string | null;
  };

export type ProviderEventRow = {
  id: string;
  provider_key: string;
  provider_message_id: string | null;
  event_kind: EmailDeliveryStatus | "reporting" | "ignored" | null;
  occurred_at: string | null;
  job_id: string | null;
  reconciled_at: string | null;
};

export type MemoryStore = EmailStore & {
  jobs: Map<string, StoredJob>;
  leads: Map<string, LeadRow>;
  suppressions: Map<string, string>;
  returnTokens: ReturnTokenInsert[];
  preferenceCredentials: Array<{ leadPlanId: string; tokenHash: string }>;
  events: CanonicalEventInput[];
  alerts: OperationalAlertInput[];
  providerEvents: ProviderEventRow[];
  /** Simulates a lost lease: the next finishJob for this job id is fenced out. */
  stealLease(jobId: string): void;
};

const DELIVERY_RANK: Record<EmailDeliveryStatus, number> = {
  pending: 0,
  delayed: 1,
  delivered: 2,
  bounced: 3,
  complained: 4,
};

export function createMemoryStore(now: () => Date): MemoryStore {
  const jobs = new Map<string, StoredJob>();
  const leads = new Map<string, LeadRow>();
  const suppressions = new Map<string, string>();
  const returnTokens: ReturnTokenInsert[] = [];
  const preferenceCredentials: Array<{ leadPlanId: string; tokenHash: string }> = [];
  const events: CanonicalEventInput[] = [];
  const alerts: OperationalAlertInput[] = [];
  const providerEvents: ProviderEventRow[] = [];
  let claimCounter = 0;

  const store: MemoryStore = {
    jobs,
    leads,
    suppressions,
    returnTokens,
    preferenceCredentials,
    events,
    alerts,
    providerEvents,

    stealLease(jobId) {
      const job = jobs.get(jobId);
      if (job) job.claim_token = `stolen-${jobId}`;
    },

    async claimJobs(jobType, limit) {
      const nowIso = now().toISOString();
      const claimed: EmailJobRow[] = [];
      for (const job of jobs.values()) {
        if (claimed.length >= limit) break;
        if (job.job_type !== jobType) continue;
        if (!["pending", "retry_scheduled", "processing"].includes(job.status)) continue;
        if (job.next_attempt_at && job.next_attempt_at > nowIso) continue;
        // An unexpired lease means another worker owns the job.
        if (job.status === "processing" && job.lease_expires_at && job.lease_expires_at > nowIso) {
          continue;
        }
        claimCounter += 1;
        job.attempt_count += 1;
        job.status = "processing";
        job.locked_at = nowIso;
        job.claim_token = `claim-${claimCounter}`;
        job.lease_expires_at = new Date(now().getTime() + 120_000).toISOString();
        claimed.push({ ...(job as EmailJobRow) });
      }
      return claimed;
    },

    async getLead(leadPlanId) {
      return leads.get(leadPlanId) ?? null;
    },

    async suppressionReason(emailNormalized) {
      return suppressions.get(emailNormalized) ?? null;
    },

    async insertReturnToken(token) {
      const existing = returnTokens.findIndex((t) => t.tokenHash === token.tokenHash);
      if (existing >= 0) returnTokens[existing] = token;
      else returnTokens.push(token);
    },

    async upsertPreferenceCredential(leadPlanId, tokenHash) {
      const existing = preferenceCredentials.findIndex((c) => c.leadPlanId === leadPlanId);
      if (existing >= 0) preferenceCredentials[existing] = { leadPlanId, tokenHash };
      else preferenceCredentials.push({ leadPlanId, tokenHash });
    },

    async recordFirstProviderAttempt(jobId, claimToken, attemptedAt) {
      const job = jobs.get(jobId);
      if (!job) return false;
      // Same fencing as every other write: a lost lease records nothing.
      if (job.status !== "processing" || !claimToken || job.claim_token !== claimToken) {
        return false;
      }
      // The first recorded boundary is immutable across later provider retries.
      job.first_provider_attempt_at = job.first_provider_attempt_at ?? attemptedAt;
      return true;
    },

    async deferJob(jobId, claimToken, nextAttemptAt, restoredAttemptCount) {
      const job = jobs.get(jobId);

      if (!job) return false;
      // Same fencing as a terminal transition; no event is ever written.
      if (job.status !== "processing" || !claimToken || job.claim_token !== claimToken)
        return false;
      Object.assign(job, {
        status: "retry_scheduled",
        next_attempt_at: nextAttemptAt,
        attempt_count: restoredAttemptCount,
        claim_token: null,
        locked_at: null,
        lease_expires_at: null,
      });
      return true;
    },

    async finishJob(jobId, claimToken, status, patch, eventName) {
      const job = jobs.get(jobId);
      if (!job) return false;
      // Fencing: only the current lease owner may write a terminal result.
      if (job.status !== "processing" || !claimToken || job.claim_token !== claimToken)
        return false;

      Object.assign(job, patch, {
        status,
        locked_at: null,
        lease_expires_at: null,
        claim_token: null,
        first_provider_attempt_at:
          job.first_provider_attempt_at ?? patch.first_provider_attempt_at ?? null,
      });

      if (eventName) {
        events.push({
          event_name: eventName,
          lead_plan_id: job.lead_plan_id,
          plan_version_id: job.plan_version_id,
          job_id: job.job_id,
          occurred_at: now().toISOString(),
        });
      }
      return true;
    },

    async applyDeliveryEvent(jobId, kind, occurredAt) {
      const job = jobs.get(jobId);
      if (!job) return false;
      if (DELIVERY_RANK[kind] <= DELIVERY_RANK[job.delivery_status]) return false;
      job.delivery_status = kind;
      if (kind === "delivered") job.delivered_at = occurredAt ?? now().toISOString();
      const deliveredName = deliveredEventName(job.job_type);
      if (kind === "delivered" && deliveredName) {
        events.push({
          event_name: deliveredName,
          lead_plan_id: job.lead_plan_id,
          plan_version_id: job.plan_version_id,
          job_id: job.job_id,
          occurred_at: occurredAt ?? now().toISOString(),
        });
      }
      return true;
    },

    async reconcileProviderEvents({ jobId, providerKey, providerMessageId }) {
      let applied = 0;
      const pending = providerEvents
        .filter(
          (e) =>
            e.reconciled_at === null &&
            e.provider_key === providerKey &&
            e.provider_message_id === providerMessageId,
        )
        .sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));

      for (const event of pending) {
        const kind = event.event_kind;
        if (
          kind === "delivered" ||
          kind === "delayed" ||
          kind === "bounced" ||
          kind === "complained"
        ) {
          if (await store.applyDeliveryEvent(jobId, kind, event.occurred_at)) applied += 1;
        }
        event.job_id = jobId;
        event.reconciled_at = now().toISOString();
      }
      return applied;
    },

    async recordEvent(event) {
      events.push(event);
    },

    async recordAlert(alert) {
      alerts.push(alert);
    },

    async raiseStaleAlerts(jobType, createdBeforeIso) {
      let raised = 0;
      for (const job of jobs.values()) {
        if (job.job_type !== jobType) continue;
        if (job.created_at >= createdBeforeIso) continue;
        if (job.alerted_stale_at) continue;
        if (!["pending", "processing", "retry_scheduled"].includes(job.status)) continue;
        job.alerted_stale_at = now().toISOString();
        alerts.push({
          alert_type: `${job.job_type}_pending_too_long`,
          severity: "warning",
          job_id: job.job_id,
          lead_plan_id: job.lead_plan_id,
          details: { created_at: job.created_at, job_status: job.status },
        });
        raised += 1;
      }
      return raised;
    },
  };

  return store;
}

export function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead-1",
    plan_version_id: "version-1",
    first_name: "Todd",
    email_original: "Reader@Example.com",
    email_normalized: "reader@example.com",
    email_suppressed_at: null,
    email_suppression_reason: null,
    // A signed-up identity holds active Plan-email consent by default.
    plan_email_consent_active: true,
    plan_email_consent_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeJob(overrides: Partial<EmailJobRow> = {}): EmailJobRow {
  const createdAt = overrides.created_at ?? "2026-02-01T11:55:00.000Z";
  return {
    job_id: "job-1",
    job_type: "plan_ready",
    job_version: "v1",
    template_version: "plan_ready_v1",
    lead_plan_id: "lead-1",
    plan_version_id: "version-1",
    source_event_id: "event-1",
    idempotency_key: "plan_ready:version-1:v1",
    eligible_at: createdAt,
    status: "pending",
    delivery_status: "pending",
    attempt_count: 0,
    next_attempt_at: null,
    locked_at: null,
    lease_expires_at: null,
    claim_token: null,
    first_provider_attempt_at: null,
    manual_review_at: null,
    provider_key: null,
    provider_message_id: null,
    created_at: createdAt,
    ...overrides,
  };
}
