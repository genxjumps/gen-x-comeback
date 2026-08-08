// Purpose-limited Gen X Jumps 7-Day Plan email preferences. This page controls
// Plan email consent ONLY: general Gen X Jumps marketing consent is never read
// or written here, and there is no general-marketing UI or sending system.
// Changing Plan preferences never revokes plan access and never removes or
// bypasses hard-bounce or complaint suppression.
import { createFileRoute } from "@tanstack/react-router";
import { RAW_TOKEN_RE, hashAccessToken } from "@/lib/lead-plan";
import { renderStaticPage } from "@/lib/static-page";

function shell(body: string): Response {
  return new Response(renderStaticPage("Email Preferences | Gen X Jumps", body), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; img-src 'none'; style-src 'unsafe-inline'",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function generic(): Response {
  return shell(
    `<h1 class="gxj-title">This Preferences Link No Longer Works</h1>
<p class="gxj-copy">This link is not usable. Your saved plan is unaffected.</p>
<div class="gxj-actions"><a class="gxj-button" href="/assessment/start">Get Back to Your Plan</a></div>`,
  );
}

/** Resolves the purpose-limited credential to a lead id, or null. */
async function throttled(scope: string, request: Request): Promise<boolean> {
  const { callerBucketKey, consumeRateLimit } = await import("@/lib/email/rate-limit.server");
  const decision = await consumeRateLimit(callerBucketKey(scope, request), 300, 30);
  return !decision.allowed;
}

async function resolveCredential(raw: string | null): Promise<string | null> {
  if (!raw || !RAW_TOKEN_RE.test(raw)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("email_preference_credentials")
    .select("lead_plan_id")
    .eq("token_hash", await hashAccessToken(raw))
    .is("revoked_at", null)
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.lead_plan_id ?? null;
}

/** Approved Plan-email-specific copy. */
export const PREFS_HEADING = "Gen X Jumps 7-Day Plan Emails";
export const PREFS_SUBSCRIBED_COPY = "You are currently receiving Gen X Jumps 7-Day Plan emails.";
export const PREFS_UNSUBSCRIBED_COPY =
  "You are not receiving Gen X Jumps 7-Day Plan emails. Your saved plan and your plan access are unaffected.";
export const PREFS_SCOPE_NOTE =
  "This only changes Gen X Jumps 7-Day Plan emails. Your saved plan and your plan access stay exactly as they are.";

/**
 * Narrow structural view of the service-role client for the consent boundary.
 * The RPC stays a method call on the client so the SDK keeps its receiver.
 */
type ConsentRpcClient = {
  rpc(
    fn: "set_plan_email_consent",
    args: { p_lead_plan_id: string; p_active: boolean; p_source: string },
  ): PromiseLike<{ error: { code?: string | null } | null }>;
};

export const Route = createFileRoute("/email-preferences")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (await throttled("prefs_get", request)) return generic();
        const credential = new URL(request.url).searchParams.get("c");
        const leadPlanId = await resolveCredential(credential);
        if (!leadPlanId) return generic();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("lead_plans")
          .select("plan_email_consent_active")
          .eq("id", leadPlanId)
          .limit(1);
        const active = data?.[0]?.plan_email_consent_active !== false;

        return shell(
          `<h1 class="gxj-title">${PREFS_HEADING}</h1>
<p class="gxj-copy">${active ? PREFS_SUBSCRIBED_COPY : PREFS_UNSUBSCRIBED_COPY}</p>
<form method="post" action="/email-preferences" class="gxj-form">
<input type="hidden" name="c" value="${escapeAttr(credential ?? "")}" />
<input type="hidden" name="action" value="${active ? "unsubscribe" : "resubscribe"}" />
<button type="submit" class="gxj-button">${
            active ? "Unsubscribe from 7-Day Plan emails" : "Resubscribe to 7-Day Plan emails"
          }</button>
</form>
<p class="gxj-note">${PREFS_SCOPE_NOTE}</p>`,
        );
      },

      POST: async ({ request }) => {
        if (await throttled("prefs_post", request)) return generic();
        const form = await request.formData();
        const credential = typeof form.get("c") === "string" ? (form.get("c") as string) : null;
        const action = form.get("action") === "resubscribe" ? "resubscribe" : "unsubscribe";
        const leadPlanId = await resolveCredential(credential);
        if (!leadPlanId) return generic();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Authoritative atomic Plan-email consent transition. An unsubscribe also
        // permanently cancels every unsent proactive lifecycle job, so no later
        // proactive email can send. General marketing consent is never touched,
        // and suppression records are never removed or bypassed.
        const client = supabaseAdmin as unknown as ConsentRpcClient;
        await client.rpc("set_plan_email_consent", {
          p_lead_plan_id: leadPlanId,
          p_active: action === "resubscribe",
          p_source: "plan_preferences",
        });

        return shell(
          `<h1 class="gxj-title">Preferences Updated</h1>
<p class="gxj-copy">${
            action === "unsubscribe"
              ? "You will no longer receive Gen X Jumps 7-Day Plan emails."
              : "You will receive Gen X Jumps 7-Day Plan emails again."
          } Your saved plan access is unchanged.</p>
<div class="gxj-actions"><a class="gxj-button" href="/your-plan">Go to My Plan</a></div>`,
        );
      },
    },
  },
});
