// Deliberate server-side token exchange for the Open My Plan link. Server-only.
// A raw GET, prefetch, scanner, or provider click never reaches this module.
import { RAW_TOKEN_RE, generateAccessToken, hashAccessToken } from "@/lib/lead-plan";
import { RETURN_SESSION_TTL_MS } from "@/lib/email/types";
import {
  DEFAULT_RETURN_DESTINATION,
  resolveReturnDestination,
  type ReturnDestination,
  type ReturnTokenJobIdentity,
} from "@/lib/email/return-destination";
import {
  PLAN_READY_LINK_EXCHANGE_EVENT,
  resolveLinkExchangeAttribution,
} from "@/lib/email/link-exchange-event";

export type ExchangeResult =
  | {
      ok: true;
      sessionToken: string;
      expiresAt: Date;
      destination: ReturnDestination;
      platformAuthTokenHash: string | null;
    }
  | { ok: false };

/**
 * Verifies an opaque return token, refreshes the authorized 7-Day session,
 * records verification/engagement, and creates a one-time Supabase magic-link
 * token hash for the same verified email so the browser can establish the
 * unified member session used by Home / My Programs / Accelerator.
 *
 * The platform bridge is best-effort. If Supabase Auth cannot generate the
 * handoff token, the already-valid 7-Day secure-link flow still succeeds.
 * Invalid, expired, revoked, malformed, and replaced return tokens all return
 * `{ ok: false }` before any auth handoff is attempted.
 */
export async function exchangeReturnToken(rawToken: string | null): Promise<ExchangeResult> {
  if (!rawToken || !RAW_TOKEN_RE.test(rawToken)) return { ok: false };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = await hashAccessToken(rawToken);
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: tokens, error } = await supabaseAdmin
    .from("plan_return_tokens")
    .select(
      "token_id, lead_plan_id, plan_version_id, purpose, expires_at, revoked_at, use_count, job_id",
    )
    .eq("token_hash", tokenHash)
    .limit(1);

  if (error) throw new Error(error.message);

  const token = tokens?.[0];
  if (!token) return { ok: false };
  if (token.revoked_at) return { ok: false };
  if (new Date(token.expires_at).getTime() <= now.getTime()) return { ok: false };

  const { data: leads, error: leadError } = await supabaseAdmin
    .from("lead_plans")
    .select("id, plan_version_id, email_verified_at, email_original")
    .eq("id", token.lead_plan_id)
    .limit(1);
  if (leadError) throw new Error(leadError.message);
  const lead = leads?.[0];
  if (!lead) return { ok: false };

  // A replaced plan version must never be restored by an old link.
  if (lead.plan_version_id !== token.plan_version_id) return { ok: false };

  // Destination and event selection come only from trusted server-side state,
  // never from request input.
  let destination = DEFAULT_RETURN_DESTINATION;
  let exchangeEvent = PLAN_READY_LINK_EXCHANGE_EVENT;
  let exchangeJobId: string | null = null;
  if (token.job_id) {
    const { data: jobs, error: jobError } = await supabaseAdmin
      .from("email_jobs")
      .select("job_id, job_type, job_version, template_version, lead_plan_id, plan_version_id")
      .eq("job_id", token.job_id)
      .limit(1);
    if (jobError) throw new Error(jobError.message);
    const job = jobs?.[0];
    const identity: (ReturnTokenJobIdentity & { jobId: string | null }) | null = job
      ? {
          jobId: job.job_id,
          jobType: job.job_type,
          jobVersion: job.job_version,
          templateVersion: job.template_version,
          leadPlanId: job.lead_plan_id,
          planVersionId: job.plan_version_id,
        }
      : null;
    const trusted = {
      purpose: token.purpose,
      leadPlanId: lead.id,
      planVersionId: lead.plan_version_id,
      job: identity,
    };
    destination = resolveReturnDestination(trusted);
    const attribution = resolveLinkExchangeAttribution(trusted);
    exchangeEvent = attribution.eventName;
    exchangeJobId = attribution.jobId;
  }

  const sessionToken = generateAccessToken();
  const expiresAt = new Date(now.getTime() + RETURN_SESSION_TTL_MS);
  const { error: sessionError } = await supabaseAdmin.from("return_link_sessions").insert({
    session_token_hash: await hashAccessToken(sessionToken),
    lead_plan_id: lead.id,
    plan_version_id: lead.plan_version_id,
    token_id: token.token_id,
    issued_at: nowIso,
    expires_at: expiresAt.toISOString(),
    last_seen_at: nowIso,
  });
  if (sessionError) throw new Error(sessionError.message);

  await supabaseAdmin
    .from("plan_return_tokens")
    .update({ last_used_at: nowIso, use_count: (token.use_count ?? 0) + 1 })
    .eq("token_id", token.token_id);

  // Verification is set only by a completed exchange, and only when empty.
  await supabaseAdmin
    .from("lead_plans")
    .update({
      email_last_engaged_at: nowIso,
      ...(lead.email_verified_at ? {} : { email_verified_at: nowIso }),
    })
    .eq("id", lead.id);

  await supabaseAdmin.from("canonical_events").insert([
    {
      event_name: exchangeEvent,
      lead_plan_id: lead.id,
      plan_version_id: lead.plan_version_id,
      // Internal job identifier only; no recipient or assessment data.
      job_id: exchangeJobId,
      occurred_at: nowIso,
    },
    {
      event_name: "return_session_started",
      lead_plan_id: lead.id,
      plan_version_id: lead.plan_version_id,
      occurred_at: nowIso,
    },
  ]);

  let platformAuthTokenHash: string | null = null;
  try {
    // Some deterministic unit tests intentionally provide only the database
    // surface of the admin client. Treat an absent Auth mock the same way as an
    // unavailable bridge instead of turning those tests into false error logs.
    const authAdmin = supabaseAdmin.auth?.admin;
    if (authAdmin) {
      const { data: authLink, error: authLinkError } = await authAdmin.generateLink({
        type: "magiclink",
        email: lead.email_original,
      });
      if (authLinkError) {
        console.error("[Auth] Could not create the member-session handoff.", authLinkError);
      } else {
        platformAuthTokenHash = authLink.properties.hashed_token || null;
      }
    }
  } catch (authError) {
    console.error("[Auth] Could not create the member-session handoff.", authError);
  }

  return { ok: true, sessionToken, expiresAt, destination, platformAuthTokenHash };
}
