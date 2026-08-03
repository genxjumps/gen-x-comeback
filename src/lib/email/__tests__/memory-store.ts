// Deterministic in-memory EmailStore for acceptance tests. No database, no clock.
import type { EmailJobPatch, EmailStore, ReturnTokenInsert } from "@/lib/email/store";
import type {
  CanonicalEventInput,
  EmailJobRow,
  LeadRow,
  OperationalAlertInput,
} from "@/lib/email/types";

export type MemoryStore = EmailStore & {
  jobs: Map<string, EmailJobRow & EmailJobPatch>;
  leads: Map<string, LeadRow>;
  suppressions: Map<string, string>;
  returnTokens: ReturnTokenInsert[];
  preferenceCredentials: Array<{ leadPlanId: string; tokenHash: string }>;
  events: CanonicalEventInput[];
  alerts: OperationalAlertInput[];
  staleJobIds: string[];
};

export function createMemoryStore(now: () => Date): MemoryStore {
  const jobs = new Map<string, EmailJobRow & EmailJobPatch>();
  const leads = new Map<string, LeadRow>();
  const suppressions = new Map<string, string>();
  const returnTokens: ReturnTokenInsert[] = [];
  const preferenceCredentials: Array<{ leadPlanId: string; tokenHash: string }> = [];
  const events: CanonicalEventInput[] = [];
  const alerts: OperationalAlertInput[] = [];
  const staleJobIds: string[] = [];

  return {
    jobs,
    leads,
    suppressions,
    returnTokens,
    preferenceCredentials,
    events,
    alerts,
    staleJobIds,

    async claimJobs(jobType, limit) {
      const nowIso = now().toISOString();
      const claimed: EmailJobRow[] = [];
      for (const job of jobs.values()) {
        if (claimed.length >= limit) break;
        if (job.job_type !== jobType) continue;
        if (!["pending", "retry_scheduled"].includes(job.status)) continue;
        if (job.next_attempt_at && job.next_attempt_at > nowIso) continue;
        // An unexpired lease means another worker owns the job.
        if (job.lease_expires_at && job.lease_expires_at > nowIso) continue;
        job.attempt_count += 1;
        job.status = "processing";
        job.locked_at = nowIso;
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
      returnTokens.push(token);
    },

    async upsertPreferenceCredential(leadPlanId, tokenHash) {
      preferenceCredentials.push({ leadPlanId, tokenHash });
    },

    async updateJob(jobId, patch) {
      const job = jobs.get(jobId);
      if (job) Object.assign(job, patch);
    },

    async recordEvent(event) {
      events.push(event);
    },

    async recordAlert(alert) {
      alerts.push(alert);
    },

    async listStaleJobs(jobType, createdBeforeIso) {
      return [...jobs.values()]
        .filter(
          (j) =>
            j.job_type === jobType &&
            j.created_at < createdBeforeIso &&
            !j.alerted_stale_at &&
            ["pending", "retry_scheduled", "processing"].includes(j.status),
        )
        .map((j) => ({ job_id: j.job_id, lead_plan_id: j.lead_plan_id, created_at: j.created_at }));
    },
  };
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
    ...overrides,
  };
}

export function makeJob(overrides: Partial<EmailJobRow> = {}): EmailJobRow {
  return {
    job_id: "job-1",
    job_type: "plan_ready",
    job_version: "v1",
    template_version: "plan_ready_v1",
    lead_plan_id: "lead-1",
    plan_version_id: "version-1",
    source_event_id: "event-1",
    idempotency_key: "plan_ready:version-1:v1",
    status: "pending",
    delivery_status: "pending",
    attempt_count: 0,
    next_attempt_at: null,
    locked_at: null,
    lease_expires_at: null,
    provider_key: null,
    provider_message_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
