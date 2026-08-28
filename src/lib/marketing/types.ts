export const MARKETING_SYNC_MAX_ATTEMPTS = 6;

export const MARKETING_SYNC_RETRY_DELAYS_MS = [
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
] as const;

export type MarketingSyncJob = {
  job_id: string;
  lead_plan_id: string;
  consent_at: string;
  status: "pending" | "processing" | "retry_scheduled";
  attempt_count: number;
  claim_token: string;
};

export type MarketingLead = {
  id: string;
  email_normalized: string;
  first_name: string;
  marketing_consent_active: boolean;
  marketing_consent_at: string | null;
  email_suppressed_at: string | null;
};

export type MarketingSyncRequest = {
  email: string;
  firstName: string;
  groupId: string;
  consentAt: string;
};

export type MarketingSyncResult =
  | { outcome: "accepted"; subscriberId: string; subscriberStatus: string | null }
  | { outcome: "retry"; errorCode: string; retryAfterMs?: number }
  | { outcome: "permanent"; errorCode: string };

export type MarketingAdapter = {
  key: "mailerlite";
  upsertSubscriber: (request: MarketingSyncRequest) => Promise<MarketingSyncResult>;
};

export type MarketingSyncFence =
  | "ok"
  | "lost_lease"
  | "consent_blocked"
  | "stale_consent"
  | "suppression_blocked";

export type MarketingSyncStore = {
  claimJobs: (limit: number, leaseSeconds: number) => Promise<MarketingSyncJob[]>;
  getLead: (leadPlanId: string) => Promise<MarketingLead | null>;
  beginAttempt: (job: MarketingSyncJob) => Promise<MarketingSyncFence>;
  finish: (
    job: MarketingSyncJob,
    input: {
      status: "provider_accepted" | "retry_scheduled" | "failed_permanent" | "suppressed";
      nextAttemptAt?: string | null;
      errorCode?: string | null;
      subscriberId?: string | null;
      acceptedAt?: string | null;
    },
  ) => Promise<boolean>;
};

export type MarketingSyncSummary = {
  claimed: number;
  accepted: number;
  retried: number;
  failed: number;
  suppressed: number;
};
