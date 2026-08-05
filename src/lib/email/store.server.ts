// Supabase-backed implementation of the email storage boundary. Server-only.
import type {
  CanonicalEventInput,
  EmailJobRow,
  LeadRow,
  OperationalAlertInput,
} from "@/lib/email/types";
import type { EmailStore, ReturnTokenInsert } from "@/lib/email/store";

export async function createSupabaseEmailStore(): Promise<EmailStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const store: EmailStore = {
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
      const { error } = await supabaseAdmin.from("plan_return_tokens").upsert(
        {
          lead_plan_id: token.leadPlanId,
          plan_version_id: token.planVersionId,
          purpose: "open_plan",
          token_hash: token.tokenHash,
          issued_at: token.issuedAt,
          expires_at: token.expiresAt,
          revoked_at: null,
          // Trusted job association; Plan Ready tokens keep the general destination.
          job_id: token.jobId ?? null,
        },
        { onConflict: "token_hash" },
      );
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

    async finishJob(jobId, claimToken, status, patch, eventName) {
      // Fenced by the claim token inside the function: a worker that lost its
      // lease cannot overwrite the owner's result.
      const { data, error } = await supabaseAdmin.rpc("finish_email_job", {
        p_job_id: jobId,
        p_claim_token: claimToken as string,
        p_status: status,
        p_patch: patch as Record<string, string | null>,
        p_event_name: eventName ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },

    async deferJob(jobId, claimToken, nextAttemptAt, restoredAttemptCount) {
      // Compare-and-set on (job_id, claim_token, status): a worker that lost its
      // lease cannot rewrite the owner's job. No canonical event is written.
      const { data, error } = await supabaseAdmin
        .from("email_jobs")
        .update({
          status: "retry_scheduled",
          next_attempt_at: nextAttemptAt,
          attempt_count: restoredAttemptCount,
          claim_token: null,
          locked_at: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId)
        .eq("claim_token", claimToken as string)
        .eq("status", "processing")
        .select("job_id");
      if (error) throw new Error(error.message);
      return (data?.length ?? 0) > 0;
    },

    async applyDeliveryEvent(jobId, kind, occurredAt) {
      const { data, error } = await supabaseAdmin.rpc("apply_email_delivery_event", {
        p_job_id: jobId,
        p_kind: kind,
        ...(occurredAt ? { p_occurred_at: occurredAt } : {}),
      });
      if (error) throw new Error(error.message);
      return data === true;
    },

    async reconcileProviderEvents({ jobId, providerKey, providerMessageId }) {
      const { data, error } = await supabaseAdmin
        .from("email_provider_events")
        .select("id, event_kind, occurred_at")
        .eq("provider_key", providerKey)
        .eq("provider_message_id", providerMessageId)
        .is("reconciled_at", null)
        .order("occurred_at", { ascending: true })
        .limit(50);
      if (error) throw new Error(error.message);

      const nowIso = new Date().toISOString();
      let applied = 0;
      for (const row of data ?? []) {
        const kind = row.event_kind;
        if (
          kind === "delivered" ||
          kind === "delayed" ||
          kind === "bounced" ||
          kind === "complained"
        ) {
          const ok = await store.applyDeliveryEvent(jobId, kind, row.occurred_at);
          if (ok) applied += 1;
        }
        await supabaseAdmin
          .from("email_provider_events")
          .update({ job_id: jobId, matched_at: nowIso, reconciled_at: nowIso })
          .eq("id", row.id);
      }
      return applied;
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

    async raiseStaleAlerts(jobType, createdBeforeIso) {
      const { data, error } = await supabaseAdmin.rpc("raise_stale_email_job_alerts", {
        p_job_type: jobType,
        p_cutoff: createdBeforeIso,
      });
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : 0;
    },
  };

  return store;
}

export type { EmailJobRow };
