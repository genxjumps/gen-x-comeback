// Supabase-backed implementation of the email storage boundary. Server-only.
import type {
  CanonicalEventInput,
  EmailJobRow,
  LeadRow,
  OperationalAlertInput,
} from "@/lib/email/types";
import type { EmailStore, ReturnTokenInsert } from "@/lib/email/store";

/**
 * `options.leadPlanScope` is a staging-only, fake-provider affordance: when set,
 * job claiming is routed through `claim_email_jobs_for_lead`, which applies an
 * authoritative `lead_plan_id` filter inside the same atomic claim. Production
 * callers pass no options and keep the existing `claim_email_jobs` behavior
 * byte-for-byte.
 */
export async function createSupabaseEmailStore(options?: {
  leadPlanScope?: string;
}): Promise<EmailStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const leadPlanScope = options?.leadPlanScope ?? null;

  const store: EmailStore = {
    async claimJobs(jobType, limit, leaseSeconds) {
      if (leadPlanScope) {
        // Narrowly typed boundary: the staging RPC is intentionally absent from
        // the generated Supabase types, which are never regenerated here.
        const { data, error } = await (
          supabaseAdmin.rpc as unknown as (
            fn: "claim_email_jobs_for_lead",
            args: {
              p_job_type: string;
              p_lead_plan_id: string;
              p_limit: number;
              p_lease_seconds: number;
            },
          ) => Promise<{ data: unknown; error: { message: string } | null }>
        )("claim_email_jobs_for_lead", {
          p_job_type: jobType,
          p_lead_plan_id: leadPlanScope,
          p_limit: limit,
          p_lease_seconds: leaseSeconds,
        });
        if (error) throw new Error(error.message);
        // Defense in depth: never hand back a row outside the requested scope.
        return ((data ?? []) as EmailJobRow[]).filter((row) => row.lead_plan_id === leadPlanScope);
      }

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
          // Recovery credentials are purpose-limited; every other credential
          // keeps the established open_plan purpose byte-for-byte.
          purpose: token.purpose ?? "open_plan",
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

    async recordFirstProviderAttempt(jobId, claimToken, attemptedAt) {
      // Fenced compare-and-set that only ever fills an empty boundary, so the
      // original first-provider-attempt timestamp is immutable.
      const { data, error } = await supabaseAdmin
        .from("email_jobs")
        .update({ first_provider_attempt_at: attemptedAt, updated_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("claim_token", claimToken as string)
        .eq("status", "processing")
        .is("first_provider_attempt_at", null)
        .select("job_id");
      if (error) throw new Error(error.message);
      if ((data?.length ?? 0) > 0) return true;

      // No row updated: either the lease was lost, or this job already recorded
      // its immutable boundary on an earlier attempt.
      const { data: existing, error: readError } = await supabaseAdmin
        .from("email_jobs")
        .select("first_provider_attempt_at")
        .eq("job_id", jobId)
        .eq("claim_token", claimToken as string)
        .eq("status", "processing")
        .limit(1);
      if (readError) throw new Error(readError.message);
      return Boolean(existing?.[0]?.first_provider_attempt_at);
    },

    async deferJob(jobId, claimToken, nextAttemptAt, restoredAttemptCount) {
      // A deferral is not a provider attempt: the claim-time increment is
      // restored so repeated lifecycle deferrals never consume the retry budget.
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
