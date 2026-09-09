import type { SignupRecoveryRows } from "@/integrations/supabase/signup-recovery.types";
import { createHmac } from "node:crypto";
import { signupRpc } from "@/lib/signup-recovery.server";
import { readEmailTokenSecret } from "@/lib/email/credentials.server";
import { evaluateSendingGate, readEmailConfig, resolveAppOrigin } from "@/lib/email/config.server";
import { createResendAdapter, createFakeAdapter } from "@/lib/email/adapters.server";
import { hashAccessToken } from "@/lib/lead-plan";
import { renderSignupWelcome, welcomeRetryDecision } from "@/lib/email/signup-welcome";
import type { EmailAdapter } from "@/lib/email/types";

export type WelcomeJob = SignupRecoveryRows["lead_intake_welcome_jobs"];

export async function dispatchSignupWelcome(
  invocationId: string,
  limit = 10,
  adapterOverride?: EmailAdapter,
) {
  const config = readEmailConfig();
  const secret = readEmailTokenSecret();
  const summary: { claimed: number; outcomes: Array<{ jobId: string; outcome: string }> } = {
    claimed: 0,
    outcomes: [],
  };
  if (!evaluateSendingGate(config).enabled || !secret) return summary;
  const jobs = await signupRpc<WelcomeJob[]>("claim_signup_welcome_jobs", {
    p_invocation_id: invocationId,
    p_limit: limit,
  });
  summary.claimed = jobs.length;
  const adapter =
    adapterOverride ??
    (config.providerKey === "fake"
      ? createFakeAdapter()
      : createResendAdapter(config.providerApiKey!));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Table access is server-only. Kept narrow until schema generation.
  const db = supabaseAdmin as unknown as {
    from(name: string): ReturnType<typeof supabaseAdmin.from>;
  };
  for (const job of jobs) {
    const finish = async (status: string, patch: Record<string, unknown> = {}) => {
      const ok = await signupRpc<boolean>("finish_signup_welcome_job", {
        p_job_id: job.job_id,
        p_claim_token: job.claim_token,
        p_status: status,
        p_patch: patch,
      });
      summary.outcomes.push({ jobId: job.job_id, outcome: ok ? status : "lost_lease" });
    };
    if (
      welcomeRetryDecision(job.attempt_count, job.first_provider_attempt_at, new Date()) === "stop"
    ) {
      await finish("failed_permanent", { last_error_code: "retry_horizon_exceeded" });
      continue;
    }
    const { data: intakes, error } = await db
      .from("lead_intakes")
      .select("email_original")
      .eq("intake_id", job.intake_id)
      .limit(1);
    if (error || !intakes?.[0]) throw new Error("welcome_identity_unavailable");
    const raw = createHmac("sha256", secret)
      .update(`gxj:signup-welcome:v1:${job.job_id}`)
      .digest("base64url");
    const expires = job.token_expires_at ?? new Date(Date.now() + 30 * 86400000).toISOString();
    const { error: tokenError } = await db
      .from("lead_intake_welcome_jobs")
      .update({ token_hash: await hashAccessToken(raw), token_expires_at: expires })
      .eq("job_id", job.job_id)
      .eq("claim_token", job.claim_token);
    if (tokenError) throw new Error("welcome_token_unavailable");
    const rendered = renderSignupWelcome(`${resolveAppOrigin(config)}/signup/return?token=${raw}`);
    const fence = await signupRpc<{ outcome: string; submission_attempt_id?: string }>(
      "begin_signup_welcome_attempt",
      {
        p_job_id: job.job_id,
        p_claim_token: job.claim_token,
        p_invocation_id: invocationId,
      },
    );
    if (fence.outcome !== "ok" || !fence.submission_attempt_id) {
      await finish(fence.outcome === "suppression_blocked" ? "suppressed" : "retry_scheduled", {
        deferred: true,
        next_attempt_at: new Date(Date.now() + 300000).toISOString(),
        last_error_code: fence.outcome,
      });
      continue;
    }
    const result = await adapter.send({
      to: (intakes[0] as unknown as { email_original: string }).email_original,
      fromEmail: config.fromEmail!,
      fromName: config.fromName,
      replyTo: config.replyTo!,
      ...rendered,
      idempotencyKey: job.idempotency_key,
      correlationId: job.job_id,
      disableClickTracking: true,
    });
    const completed = await signupRpc<boolean>("complete_signup_welcome_attempt", {
      p_attempt_id: fence.submission_attempt_id,
      p_outcome: result.outcome,
      p_provider_key: adapter.key,
      p_message_id: result.outcome === "accepted" ? result.providerMessageId : null,
      p_error: result.outcome === "accepted" ? null : result.errorCode,
    });
    if (!completed) throw new Error("welcome_attempt_evidence_unavailable");
    if (result.outcome === "accepted") {
      await finish("provider_accepted", {
        provider_key: result.providerKey,
        provider_message_id: result.providerMessageId,
        provider_accepted_at: result.acceptedAt,
      });
      await signupRpc("reconcile_signup_welcome_events", { p_job_id: job.job_id });
    } else {
      const permanent = result.outcome === "permanent" || job.attempt_count >= 6;
      await finish(permanent ? "failed_permanent" : "retry_scheduled", {
        last_error_code: result.errorCode,
        next_attempt_at: permanent
          ? null
          : new Date(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempt_count)).toISOString(),
      });
    }
  }
  return summary;
}
