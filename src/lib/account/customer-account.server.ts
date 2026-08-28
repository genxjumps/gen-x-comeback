import type { User } from "@supabase/supabase-js";

import type { CustomerAccountResult } from "@/lib/account/types";

export type VerifiedCustomerIdentity = {
  authUserId: string;
  emailNormalized: string;
  emailOriginal: string;
  emailVerifiedAt: string;
  firstName: string | null;
};

function bearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token.split(".").length === 3 ? token : null;
}

function firstNameFromUser(user: User): string | null {
  const metadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : {};
  for (const candidate of [metadata.first_name, metadata.given_name, metadata.name]) {
    if (typeof candidate !== "string") continue;
    const firstName = candidate.trim().split(/\s+/)[0];
    if (firstName.length >= 1 && firstName.length <= 60) return firstName;
  }
  return null;
}

/**
 * Verifies the bearer token with Supabase Auth before trusting its email.
 * A session without a confirmed email can use neither account linking nor the
 * future paid-program ownership domain.
 */
export async function resolveVerifiedCustomerIdentity(
  authorizationHeader: string | null,
): Promise<VerifiedCustomerIdentity | null> {
  const token = bearerToken(authorizationHeader);
  if (!token) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data.user;
  if (error || !user || user.is_anonymous || !user.email || !user.email_confirmed_at) return null;

  const emailOriginal = user.email.trim();
  const emailNormalized = emailOriginal.toLowerCase();
  if (emailNormalized.length < 3 || emailNormalized.length > 254) return null;

  return {
    authUserId: user.id,
    emailNormalized,
    emailOriginal,
    emailVerifiedAt: user.email_confirmed_at,
    firstName: firstNameFromUser(user),
  };
}

export async function resolveCustomerAccount(
  authorizationHeader: string | null,
): Promise<CustomerAccountResult> {
  const identity = await resolveVerifiedCustomerIdentity(authorizationHeader);
  if (!identity) return { ok: false };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("resolve_verified_customer_account", {
    p_auth_user_id: identity.authUserId,
    p_email_normalized: identity.emailNormalized,
    p_email_original: identity.emailOriginal,
    p_email_verified_at: identity.emailVerifiedAt,
    p_first_name: identity.firstName,
  });
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row || !["created", "replayed"].includes(row.outcome)) return { ok: false };

  return {
    ok: true,
    account: {
      id: row.customer_id,
      email: identity.emailNormalized,
      firstName: row.customer_first_name,
      linkedLeadPlans: row.linked_lead_plans,
    },
    replayed: row.replayed,
  };
}

export async function currentAuthorizationHeader(): Promise<string | null> {
  try {
    const mod = await import("@tanstack/react-start/server");
    const request = (mod as { getRequest?: () => Request }).getRequest?.();
    return request?.headers.get("authorization") ?? null;
  } catch {
    return null;
  }
}
