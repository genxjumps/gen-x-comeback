import { RAW_TOKEN_RE, hashAccessToken } from "@/lib/lead-plan";

export type PaidAccessExchangeResult =
  | { ok: true; platformAuthTokenHash: string; destination: "/my-programs" }
  | { ok: false };

/**
 * Exchanges one reusable paid-access credential for a fresh, one-browser
 * Supabase Auth handoff. The source token and every existing browser session
 * remain valid. Account-scoped recovery does not grant program ownership.
 * Entitlement-bound credentials still require active ownership.
 */
export async function exchangePaidAccessToken(
  rawToken: string | null,
): Promise<PaidAccessExchangeResult> {
  if (!rawToken || !RAW_TOKEN_RE.test(rawToken)) return { ok: false };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const nowIso = now.toISOString();
  const { data: tokens, error: tokenError } = await supabaseAdmin
    .from("paid_access_tokens")
    .select("token_id, job_id, customer_id, entitlement_id, expires_at, revoked_at, use_count")
    .eq("token_hash", await hashAccessToken(rawToken))
    .limit(1);
  if (tokenError) throw new Error(tokenError.message);
  const token = tokens?.[0];
  if (!token || token.revoked_at || new Date(token.expires_at).getTime() <= now.getTime()) {
    return { ok: false };
  }

  if (token.entitlement_id === null) {
    const { data: jobs, error: jobError } = await supabaseAdmin
      .from("paid_access_email_jobs")
      .select("job_id")
      .eq("job_id", token.job_id)
      .eq("customer_id", token.customer_id)
      .eq("job_type", "paid_recovery")
      .is("entitlement_id", null)
      .limit(1);
    if (jobError) throw new Error(jobError.message);
    if (!jobs?.[0]) return { ok: false };
  } else {
    const { data: entitlements, error: entitlementError } = await supabaseAdmin
      .from("paid_product_entitlements")
      .select("id")
      .eq("id", token.entitlement_id)
      .eq("customer_id", token.customer_id)
      .eq("status", "active")
      .limit(1);
    if (entitlementError) throw new Error(entitlementError.message);
    if (!entitlements?.[0]) return { ok: false };
  }

  const { data: accounts, error: accountError } = await supabaseAdmin
    .from("customer_accounts")
    .select("id, auth_user_id, email_original")
    .eq("id", token.customer_id)
    .limit(1);
  if (accountError) throw new Error(accountError.message);
  const account = accounts?.[0];
  if (!account) return { ok: false };

  // Never create a replacement Auth identity for a stale account email.
  const { data: existingAuth, error: existingAuthError } =
    await supabaseAdmin.auth.admin.getUserById(account.auth_user_id);
  if (
    existingAuthError ||
    existingAuth.user?.email?.toLowerCase() !== account.email_original.toLowerCase()
  ) {
    return { ok: false };
  }

  const { data: authLink, error: authError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: account.email_original,
  });
  const platformAuthTokenHash = authLink?.properties?.hashed_token;
  if (authError || !platformAuthTokenHash || authLink.user?.id !== account.auth_user_id)
    return { ok: false };

  await supabaseAdmin
    .from("paid_access_tokens")
    .update({ last_used_at: nowIso, use_count: token.use_count + 1 })
    .eq("token_id", token.token_id);

  return { ok: true, platformAuthTokenHash, destination: "/my-programs" };
}
