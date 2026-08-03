// Supabase-backed implementation of the email storage boundary. Server-only.
import type {
  CanonicalEventInput,
  EmailJobRow,
  LeadRow,
  OperationalAlertInput,
} from "@/lib/email/types";
import type { EmailJobPatch, EmailStore, ReturnTokenInsert } from "@/lib/email/store";

export async function createSupabaseEmailStore(): Promise<EmailStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  return {
    async claimJobs(jobType, limit, leaseSeconds) {
      const { data, error } = await supabaseAdmin.rpc("claim_email_jobs", {
        p_job_type: jobType,
        p_limit: limit,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as EmailJobRow[];
    },

    async getLead(leadPlanId) {
      const { data, error } = await supabaseAdmin
        .from("lead_plans")
        .select(
          "id, plan_version_id, first_name, email_original, email_normalized, email_suppressed_at, email_suppression_reason",
        )
        .eq("id", leadPlanId)
        .limit(1);
      if (error) throw new Error(error.message);
      return (data?.[0] as LeadRow | undefined) ?? null;
    },

    async suppressionReason(emailNormalized) {
      const { data, error } = await supabaseAdmin
        .from("email_suppressions")
        .select("reason")
        .eq("email_normalized", emailNormalized)
        .limit(1);
      if (error) throw new Error(error.message);
      return data?.[0]?.reason ?? null;
    },

    async insertReturnToken(token: ReturnTokenInsert) {
      const { error } = await supabaseAdmin.from("plan_return_tokens").insert({
        lead_plan_id: token.leadPlanId,
        plan_version_id: token.planVersionId,
        purpose: "open_plan",
        token_hash: token.tokenHash,
        issued_at: token.issuedAt,
        expires_at: token.expiresAt,
      });
      if (error) throw new Error(error.message);
    },

    async upsertPreferenceCredential(leadPlanId, tokenHash) {
      const { error } = await supabaseAdmin
        .from("email_preference_credentials")
        .upsert(
          { lead_plan_id: leadPlanId, token_hash: tokenHash, revoked_at: null },
          { onConflict: "lead_plan_id" },
        );
      if (error) throw new Error(error.message);
    },

    async updateJob(jobId, patch: EmailJobPatch) {
      const { error } = await supabaseAdmin
        .from("email_jobs")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("job_id", jobId);
      if (error) throw new Error(error.message);
    },

    async recordEvent(event: CanonicalEventInput) {
      const { error } = await supabaseAdmin.from("canonical_events").insert({
        event_name: event.event_name,
        event_version: "v1",
        lead_plan_id: event.lead_plan_id ?? null,
        plan_version_id: event.plan_version_id ?? null,
        submission_id: event.submission_id ?? null,
        job_id: event.job_id ?? null,
        source: event.source ?? null,
        occurred_at: event.occurred_at ?? new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },

    async recordAlert(alert: OperationalAlertInput) {
      const { error } = await supabaseAdmin.from("operational_alerts").insert({
        alert_type: alert.alert_type,
        severity: alert.severity ?? "warning",
        job_id: alert.job_id ?? null,
        lead_plan_id: alert.lead_plan_id ?? null,
        details: alert.details ?? {},
      });
      if (error) throw new Error(error.message);
    },

    async listStaleJobs(jobType, createdBeforeIso) {
      const { data, error } = await supabaseAdmin
        .from("email_jobs")
        .select("job_id, lead_plan_id, created_at")
        .eq("job_type", jobType)
        .in("status", ["pending", "retry_scheduled"])
        .is("alerted_stale_at", null)
        .lt("created_at", createdBeforeIso)
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ job_id: string; lead_plan_id: string; created_at: string }>;
    },
  };
}

export type { EmailJobRow };
