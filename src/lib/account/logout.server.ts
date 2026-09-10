import { RAW_TOKEN_RE, hashAccessToken } from "@/lib/lead-plan";
import { RETURN_SESSION_COOKIE } from "@/lib/email/types";
import { LEAD_INTAKE_COOKIE } from "@/lib/lead-intake-handoff";
import { readCookie } from "@/lib/plan-access.server";

export const LOGOUT_COOKIES = [
  RETURN_SESSION_COOKIE,
  LEAD_INTAKE_COOKIE,
  "gxj_accelerator_checkout_claim",
] as const;

/** Only a deliberate same-origin POST may clear this browser's access. */
export async function logoutBrowserSession(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }

  let ok = true;
  try {
    const body: unknown = await request.json();
    const token = body && typeof body === "object" && "token" in body ? body.token : null;
    const cookie = readCookie(request.headers.get("cookie"), RETURN_SESSION_COOKIE);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    // Never revoke by customer, plan, or email: other devices keep their own sessions.
    if (typeof token === "string" && RAW_TOKEN_RE.test(token)) {
      const { error } = await supabaseAdmin
        .from("plan_access_sessions")
        .update({ revoked_at: now })
        .eq("token_hash", await hashAccessToken(token))
        .is("revoked_at", null);
      if (error) ok = false;
    }
    if (cookie && RAW_TOKEN_RE.test(cookie)) {
      const { error } = await supabaseAdmin
        .from("return_link_sessions")
        .update({ revoked_at: now })
        .eq("session_token_hash", await hashAccessToken(cookie))
        .is("revoked_at", null);
      if (error) ok = false;
    }
  } catch {
    ok = false;
  }

  // Clear HTTP-only handoffs even if a revocation failed. Never report success
  // for a failed operation; the Account screen keeps the retry action available.
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
  for (const name of LOGOUT_COOKIES) {
    headers.append(
      "set-cookie",
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax`,
    );
  }
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 503, headers });
}
