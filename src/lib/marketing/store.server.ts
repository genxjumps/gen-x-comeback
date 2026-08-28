import type {
  MarketingLead,
  MarketingSyncFence,
  MarketingSyncJob,
  MarketingSyncStore,
} from "@/lib/marketing/types";

type UntypedRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function createSupabaseMarketingSyncStore(): Promise<MarketingSyncStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as UntypedRpc;

  return {
    async claimJobs(limit, leaseSeconds) {
      const { data, error } = await rpc("claim_marketing_sync_jobs", {
        p_limit: limit,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as MarketingSyncJob[];
    },

    async getLead(leadPlanId) {
      const { data, error } = await supabaseAdmin
        .from("lead_plans")
        .select(
          "id, email_normalized, first_name, marketing_consent_active, marketing_consent_at, email_suppressed_at",
        )
        .eq("id", leadPlanId)
        .limit(1);
      if (error) throw new Error(error.message);
      return (data?.[0] as MarketingLead | undefined) ?? null;
    },

    async beginAttempt(job) {
      const { data, error } = await rpc("begin_marketing_sync_attempt", {
        p_job_id: job.job_id,
        p_claim_token: job.claim_token,
        p_attempted_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      const allowed = new Set<MarketingSyncFence>([
        "ok",
        "lost_lease",
        "consent_blocked",
        "stale_consent",
        "suppression_blocked",
      ]);
      return allowed.has(data as MarketingSyncFence) ? (data as MarketingSyncFence) : "lost_lease";
    },

    async finish(job, input) {
      const { data, error } = await rpc("finish_marketing_sync_job", {
        p_job_id: job.job_id,
        p_claim_token: job.claim_token,
        p_status: input.status,
        p_next_attempt_at: input.nextAttemptAt ?? null,
        p_error_code: input.errorCode ?? null,
        p_subscriber_id: input.subscriberId ?? null,
        p_provider_accepted_at: input.acceptedAt ?? null,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
  };
}
