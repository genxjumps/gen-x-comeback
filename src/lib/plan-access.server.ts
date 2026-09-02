// Resolves authorized plan access from either the same-browser access token or
// an authorized cross-device return-link session cookie. Server-only.
import { RAW_TOKEN_RE, hashAccessToken } from "@/lib/lead-plan";
import { RETURN_SESSION_COOKIE } from "@/lib/email/types";

export type PlanAccess = {
  leadPlanId: string;
  planVersionId: string;
  firstName: string;
  via: "same_browser" | "return_session";
};

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

async function recordReturnCookieProbe(source: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("canonical_events").insert({
      event_name: "return_cookie_probe",
      source,
      occurred_at: new Date().toISOString(),
    });
  } catch {
    // Diagnostic logging must never affect plan access.
  }
}

/** Reads the incoming request's cookie header inside a TanStack Start server handler. */
export async function currentCookieHeader(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const header = getRequestHeader("cookie") ?? null;
    const returnCookie = readCookie(header, RETURN_SESSION_COOKIE);
    await recordReturnCookieProbe(
      !header
        ? "cookie_header_absent"
        : returnCookie
          ? "return_cookie_present"
          : "return_cookie_absent",
    );
    return header;
  } catch {
    await recordReturnCookieProbe("cookie_reader_failed");
    return null;
  }
}

export async function resolvePlanAccess(
  rawToken: string | null | undefined,
  cookieHeader: string | null,
): Promise<PlanAccess | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (typeof rawToken === "string" && RAW_TOKEN_RE.test(rawToken)) {
    const tokenHash = await hashAccessToken(rawToken);

    const { data: sessions, error: sessionError } = await supabaseAdmin
      .from("plan_access_sessions")
      .select("lead_plan_id, plan_version_id")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .limit(1);
    if (sessionError) throw new Error(sessionError.message);

    const session = sessions?.[0];
    if (session) {
      const lead = await loadLead(session.lead_plan_id);
      if (lead) {
        await supabaseAdmin
          .from("plan_access_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("token_hash", tokenHash);
        return { ...lead, via: "same_browser" };
      }
    }

    const { data: legacy, error: legacyError } = await supabaseAdmin
      .from("lead_plans")
      .select("id, plan_version_id, first_name")
      .eq("access_token_hash", tokenHash)
      .limit(1);
    if (legacyError) throw new Error(legacyError.message);
    const legacyLead = legacy?.[0];
    if (legacyLead) {
      return {
        leadPlanId: legacyLead.id,
        planVersionId: legacyLead.plan_version_id,
        firstName: legacyLead.first_name,
        via: "same_browser",
      };
    }
  }

  const sessionToken = readCookie(cookieHeader, RETURN_SESSION_COOKIE);
  if (!sessionToken) {
    await recordReturnCookieProbe("resolver_cookie_missing");
    return null;
  }
  if (!RAW_TOKEN_RE.test(sessionToken)) {
    await recordReturnCookieProbe("resolver_cookie_malformed");
    return null;
  }

  const sessionHash = await hashAccessToken(sessionToken);
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from("return_link_sessions")
    .select("lead_plan_id, plan_version_id, expires_at")
    .eq("session_token_hash", sessionHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .limit(1);
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row) {
    await recordReturnCookieProbe("resolver_cookie_unmatched");
    return null;
  }

  const lead = await loadLead(row.lead_plan_id);
  if (!lead || lead.planVersionId !== row.plan_version_id) {
    await recordReturnCookieProbe("resolver_cookie_plan_mismatch");
    return null;
  }

  await supabaseAdmin
    .from("return_link_sessions")
    .update({ last_seen_at: nowIso })
    .eq("session_token_hash", sessionHash);
  await recordReturnCookieProbe("resolver_cookie_matched");
  return { ...lead, via: "return_session" };
}

async function loadLead(
  leadPlanId: string,
): Promise<{ leadPlanId: string; planVersionId: string; firstName: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("lead_plans")
    .select("id, plan_version_id, first_name")
    .eq("id", leadPlanId)
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row
    ? { leadPlanId: row.id, planVersionId: row.plan_version_id, firstName: row.first_name }
    : null;
}
