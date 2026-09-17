import type { SignupRecoveryRows } from "@/integrations/supabase/signup-recovery.types";
import { createHmac } from "node:crypto";
import { generateAccessToken, hashAccessToken } from "@/lib/lead-plan";
import { LEAD_INTAKE_COOKIE } from "@/lib/lead-intake-handoff";
import { readCookie, resolvePlanAccess } from "@/lib/plan-access.server";
import { readEmailTokenSecret } from "@/lib/email/credentials.server";
import { RETURN_SESSION_COOKIE, RETURN_SESSION_TTL_MS } from "@/lib/email/types";

// Narrow transport for forward-migration RPCs; generated schema types are
// verified separately by the isolated database check.
export async function signupRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: T; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function signupCookieHash(cookie: string | null): Promise<string | null> {
  const raw = readCookie(cookie, LEAD_INTAKE_COOKIE);
  if (!raw) return null;
  try {
    return await hashAccessToken(raw);
  } catch {
    return null;
  }
}

export type SignupIntake = Pick<
  SignupRecoveryRows["lead_intakes"],
  "intake_id" | "email_normalized" | "first_name" | "completed_lead_plan_id"
>;

export async function readSignupIntake(cookie: string | null): Promise<SignupIntake | null> {
  const hash = await signupCookieHash(cookie);
  if (!hash) return null;
  const rows = await signupRpc<SignupIntake[]>("resolve_signup_intake", { p_token_hash: hash });
  return rows[0] ?? null;
}

export type SignupDestination =
  | { ok: true; state: "setup"; firstName: string; draftKey: string }
  | {
      ok: true;
      state: "plan" | "check_email";
      useCookie?: boolean;
      platformAuthTokenHash?: string | null;
    }
  | { ok: false; reason: "missing_or_expired" };

export async function resolveSignupDestination(
  cookie: string | null,
  token?: string | null,
): Promise<SignupDestination> {
  const intake = await readSignupIntake(cookie);
  if (!intake) return { ok: false, reason: "missing_or_expired" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: leads, error } = await supabaseAdmin
    .from("lead_plans")
    .select("id")
    .eq("email_normalized", intake.email_normalized)
    .limit(1);
  if (error) throw new Error(error.message);
  if (leads?.[0]) {
    const access = await resolvePlanAccess(token, cookie);
    if (access?.leadPlanId === leads[0].id) return { ok: true, state: "plan" };
    const raw = generateAccessToken();
    const opened = await signupRpc<boolean>("open_signup_existing_plan", {
      p_session_hash: await signupCookieHash(cookie),
      p_plan_session_hash: await hashAccessToken(raw),
    });
    if (!opened) return { ok: true, state: "check_email" };
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(RETURN_SESSION_COOKIE, raw, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: RETURN_SESSION_TTL_MS / 1000,
    });
    let platformAuthTokenHash: string | null = null;
    try {
      const link = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: intake.email_normalized,
      });
      platformAuthTokenHash = link.data?.properties?.hashed_token ?? null;
    } catch {
      /* The valid 7-Day session remains usable if the member bridge fails. */
    }
    return { ok: true, state: "plan", useCookie: true, platformAuthTokenHash };
  }
  const secret = readEmailTokenSecret();
  if (!secret) throw new Error("Signup recovery configuration unavailable");
  return {
    ok: true,
    state: "setup",
    firstName: intake.first_name,
    draftKey: createHmac("sha256", secret)
      .update(`signup-draft:${intake.email_normalized}`)
      .digest("hex"),
  };
}

export async function issueSignupPlanCookie(leadPlanId: string): Promise<void> {
  const raw = generateAccessToken();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: leads, error } = await supabaseAdmin
    .from("lead_plans")
    .select("plan_version_id")
    .eq("id", leadPlanId)
    .limit(1);
  if (error || !leads?.[0]) throw new Error("Saved plan session unavailable");
  const { error: sessionError } = await supabaseAdmin.from("return_link_sessions").insert({
    session_token_hash: await hashAccessToken(raw),
    lead_plan_id: leadPlanId,
    plan_version_id: leads[0].plan_version_id,
    expires_at: new Date(Date.now() + RETURN_SESSION_TTL_MS).toISOString(),
  });
  if (sessionError) throw new Error("Saved plan session unavailable");
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(RETURN_SESSION_COOKIE, raw, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: RETURN_SESSION_TTL_MS / 1000,
  });
}
