// Deliberate server-side token exchange for the Open My Plan link. Server-only.
// A raw GET, prefetch, scanner, or provider click never reaches this module.
import { RAW_TOKEN_RE, generateAccessToken, hashAccessToken } from "@/lib/lead-plan";
import { RETURN_SESSION_TTL_MS } from "@/lib/email/types";
import {
  DEFAULT_RETURN_DESTINATION,
  resolveReturnDestination,
  type ReturnDestination,
} from "@/lib/email/return-destination";

export type ExchangeResult =
  | { ok: true; sessionToken: string; expiresAt: Date; destination: ReturnDestination }
  | { ok: false };

/**
 * Verifies an opaque return token, refreshes the authorized session, records
 * verification/engagement, and returns the new session token plus the trusted
 * closed destination derived from the token's originating email job.
 * Invalid, expired, revoked, malformed, and replaced tokens all return `{ ok: false }`.
 */
export async function exchangeReturnToken(rawToken: string | null): Promise<ExchangeResult> {
  if (!rawToken || !RAW_TOKEN_RE.test(rawToken)) return { ok: false };


  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = await hashAccessToken(rawToken);
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: tokens, error } = await supabaseAdmin
    .from("plan_return_tokens")
    .select("token_id, lead_plan_id, plan_version_id, expires_at, revoked_at, use_count")
    .eq("token_hash", tokenHash)
    .limit(1);
  if (error) throw new Error(error.message);

  const token = tokens?.[0];
  if (!token) return { ok: false };
  if (token.revoked_at) return { ok: false };
  if (new Date(token.expires_at).getTime() <= now.getTime()) return { ok: false };

  const { data: leads, error: leadError } = await supabaseAdmin
    .from("lead_plans")
    .select("id, plan_version_id, email_verified_at")
    .eq("id", token.lead_plan_id)
    .limit(1);
  if (leadError) throw new Error(leadError.message);
  const lead = leads?.[0];
  if (!lead) return { ok: false };

  // A replaced plan version must never be restored by an old link.
  if (lead.plan_version_id !== token.plan_version_id) return { ok: false };

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
      event_name: "email_plan_ready_link_exchange_completed",
      lead_plan_id: lead.id,
      plan_version_id: lead.plan_version_id,
      occurred_at: nowIso,
    },
    {
      event_name: "return_session_started",
      lead_plan_id: lead.id,
      plan_version_id: lead.plan_version_id,
      occurred_at: nowIso,
    },
  ]);

  return { ok: true, sessionToken, expiresAt };
}
