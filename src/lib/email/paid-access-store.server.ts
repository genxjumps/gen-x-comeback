import type { EmailDeliveryStatus, EmailJobStatus } from "@/lib/email/types";
import type {
  PaidAccessCustomer,
  PaidAccessJobPatch,
  PaidAccessJobRow,
} from "@/lib/email/paid-access-types";
import type { ProviderAttemptFence } from "@/lib/email/store";

type RpcError = { message: string } | null;

type PaidAccessRpcClient = {
  rpc(
    fn: "claim_production_paid_access_email_jobs",
    args: {
      p_job_type: string;
      p_invocation_id: string;
      p_limit: number;
      p_lease_seconds: number;
    },
  ): PromiseLike<{ data: PaidAccessJobRow[] | null; error: RpcError }>;
  rpc(
    fn: "begin_production_paid_access_provider_attempt",
    args: {
      p_job_id: string;
      p_claim_token: string | null;
      p_invocation_id: string;
      p_attempted_at: string;
    },
  ): PromiseLike<{
    data: { outcome?: string; submission_attempt_id?: string } | null;
    error: RpcError;
  }>;
  rpc(
    fn: "finish_paid_access_email_job",
    args: {
      p_job_id: string;
      p_claim_token: string | null;
      p_status: EmailJobStatus;
      p_patch: PaidAccessJobPatch;
      p_event_name?: string;
    },
  ): PromiseLike<{ data: boolean | null; error: RpcError }>;
  rpc(
    fn: "complete_production_paid_access_provider_attempt",
    args: {
      p_submission_attempt_id: string;
      p_outcome: "accepted" | "uncertain" | "transient" | "permanent";
      p_completed_at: string;
      p_provider_key?: string;
      p_provider_message_id?: string;
      p_provider_accepted_at?: string;
      p_outcome_code?: string;
    },
  ): PromiseLike<{ data: boolean | null; error: RpcError }>;
  rpc(
    fn: "reconcile_paid_access_provider_events",
    args: { p_job_id: string; p_provider_key: string; p_provider_message_id: string },
  ): PromiseLike<{ data: number | null; error: RpcError }>;
  rpc(
    fn: "defer_paid_access_email_job",
    args: { p_job_id: string; p_claim_token: string | null; p_next_attempt_at: string },
  ): PromiseLike<{ data: boolean | null; error: RpcError }>;
};

export type PaidAccessStore = {
  claimJobs(jobType: string, limit: number, leaseSeconds: number): Promise<PaidAccessJobRow[]>;
  getCustomer(customerId: string): Promise<PaidAccessCustomer | null>;
  entitlementIsActive(customerId: string, entitlementId: string): Promise<boolean>;
  suppressionReason(emailNormalized: string): Promise<string | null>;
  upsertToken(input: {
    customerId: string;
    entitlementId: string;
    jobId: string;
    tokenHash: string;
    issuedAt: string;
    expiresAt: string;
  }): Promise<void>;
  beginProviderAttempt(
    job: PaidAccessJobRow,
    attemptedAt: string,
  ): Promise<{
    outcome: ProviderAttemptFence | "entitlement_blocked";
    submissionAttemptId?: string;
  }>;
  completeProviderAttempt(input: {
    submissionAttemptId: string;
    outcome: "accepted" | "uncertain" | "transient" | "permanent";
    completedAt: string;
    providerKey?: string;
    providerMessageId?: string;
    providerAcceptedAt?: string;
    outcomeCode?: string;
  }): Promise<boolean>;
  finishJob(
    job: PaidAccessJobRow,
    status: EmailJobStatus,
    patch: PaidAccessJobPatch,
    eventName?: string,
  ): Promise<boolean>;
  deferJob(job: PaidAccessJobRow, nextAttemptAt: string): Promise<boolean>;
  reconcileProviderEvents(
    jobId: string,
    providerKey: string,
    providerMessageId: string,
  ): Promise<number>;
};

export async function createPaidAccessStore(
  productionInvocationId: string,
): Promise<PaidAccessStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpcClient = supabaseAdmin as unknown as PaidAccessRpcClient;

  return {
    async claimJobs(jobType, limit, leaseSeconds) {
      const { data, error } = await rpcClient.rpc("claim_production_paid_access_email_jobs", {
        p_job_type: jobType,
        p_invocation_id: productionInvocationId,
        p_limit: limit,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    async getCustomer(customerId) {
      const { data, error } = await supabaseAdmin
        .from("customer_accounts")
        .select("id, auth_user_id, email_original, email_normalized")
        .eq("id", customerId)
        .limit(1);
      if (error) throw new Error(error.message);
      return (data?.[0] as PaidAccessCustomer | undefined) ?? null;
    },

    async entitlementIsActive(customerId, entitlementId) {
      const { data, error } = await supabaseAdmin
        .from("paid_product_entitlements")
        .select("id")
        .eq("id", entitlementId)
        .eq("customer_id", customerId)
        .eq("status", "active")
        .limit(1);
      if (error) throw new Error(error.message);
      return Boolean(data?.[0]);
    },

    async suppressionReason(emailNormalized) {
      const { data, error } = await supabaseAdmin
        .from("email_suppressions")
        .select("reason")
        .eq("email_normalized", emailNormalized)
        .in("reason", ["hard_bounce", "complaint"])
        .limit(1);
      if (error) throw new Error(error.message);
      return data?.[0]?.reason ?? null;
    },

    async upsertToken(input) {
      const { error } = await supabaseAdmin.from("paid_access_tokens").upsert(
        {
          customer_id: input.customerId,
          entitlement_id: input.entitlementId,
          job_id: input.jobId,
          token_hash: input.tokenHash,
          issued_at: input.issuedAt,
          expires_at: input.expiresAt,
          revoked_at: null,
        },
        { onConflict: "token_hash" },
      );
      if (error) throw new Error(error.message);
    },

    async beginProviderAttempt(job, attemptedAt) {
      const { data, error } = await rpcClient.rpc("begin_production_paid_access_provider_attempt", {
        p_job_id: job.job_id,
        p_claim_token: job.claim_token,
        p_invocation_id: productionInvocationId,
        p_attempted_at: attemptedAt,
      });
      if (error) throw new Error(error.message);
      const allowed = new Set<ProviderAttemptFence | "entitlement_blocked">([
        "ok",
        "lost_lease",
        "authentication_blocked",
        "sending_disabled",
        "activation_blocked",
        "controlled_scope_blocked",
        "suppression_blocked",
        "limit_reached",
        "entitlement_blocked",
      ]);
      const raw = data?.outcome;
      const outcome = raw && allowed.has(raw as ProviderAttemptFence) ? raw : "lost_lease";
      return {
        outcome: outcome as ProviderAttemptFence | "entitlement_blocked",
        ...(data?.submission_attempt_id ? { submissionAttemptId: data.submission_attempt_id } : {}),
      };
    },

    async completeProviderAttempt(input) {
      const { data, error } = await rpcClient.rpc(
        "complete_production_paid_access_provider_attempt",
        {
          p_submission_attempt_id: input.submissionAttemptId,
          p_outcome: input.outcome,
          p_completed_at: input.completedAt,
          ...(input.providerKey ? { p_provider_key: input.providerKey } : {}),
          ...(input.providerMessageId ? { p_provider_message_id: input.providerMessageId } : {}),
          ...(input.providerAcceptedAt ? { p_provider_accepted_at: input.providerAcceptedAt } : {}),
          ...(input.outcomeCode ? { p_outcome_code: input.outcomeCode } : {}),
        },
      );
      if (error) throw new Error(error.message);
      return data === true;
    },

    async finishJob(job, status, patch, eventName) {
      const { data, error } = await rpcClient.rpc("finish_paid_access_email_job", {
        p_job_id: job.job_id,
        p_claim_token: job.claim_token,
        p_status: status,
        p_patch: patch,
        ...(eventName ? { p_event_name: eventName } : {}),
      });
      if (error) throw new Error(error.message);
      return data === true;
    },

    async deferJob(job, nextAttemptAt) {
      const { data, error } = await rpcClient.rpc("defer_paid_access_email_job", {
        p_job_id: job.job_id,
        p_claim_token: job.claim_token,
        p_next_attempt_at: nextAttemptAt,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },

    async reconcileProviderEvents(jobId, providerKey, providerMessageId) {
      const { data, error } = await rpcClient.rpc("reconcile_paid_access_provider_events", {
        p_job_id: jobId,
        p_provider_key: providerKey,
        p_provider_message_id: providerMessageId,
      });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
  };
}

export type { EmailDeliveryStatus };
