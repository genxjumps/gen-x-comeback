// Purpose-limited email preferences. Changing marketing preferences never
// revokes plan access and never suppresses the transactional Plan Ready email.
import { createFileRoute } from "@tanstack/react-router";
import { RAW_TOKEN_RE, hashAccessToken } from "@/lib/lead-plan";

const PAGE_STYLE =
  "margin:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;line-height:1.6;";

function shell(body: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Email Preferences | Gen X Jumps</title></head>
<body style="${PAGE_STYLE}"><main style="max-width:36rem;margin:0 auto;padding:2.5rem 1.25rem;">${body}</main></body></html>`,
    {
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
    },
  );
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function generic(): Response {
  return shell(
    `<h1 style="font-size:1.5rem;font-weight:600;margin:0 0 0.75rem 0;">This Preferences Link No Longer Works</h1>
<p style="margin:0 0 1.5rem 0;color:#555555;">This link is not usable. Your saved plan is unaffected.</p>
<p style="margin:0;"><a href="/assessment/start" style="display:inline-block;padding:0.75rem 1.25rem;background:#111111;color:#ffffff;text-decoration:none;border-radius:0.375rem;font-weight:600;">Get Back to Your Plan</a></p>`,
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
          .select("marketing_unsubscribed_at")
          .eq("id", leadPlanId)
          .limit(1);
        const unsubscribed = Boolean(data?.[0]?.marketing_unsubscribed_at);

        return shell(
          `<h1 style="font-size:1.5rem;font-weight:600;margin:0 0 0.75rem 0;">Email Preferences</h1>
<p style="margin:0 0 1.5rem 0;color:#555555;">${
            unsubscribed
              ? "You are currently unsubscribed from optional fitness emails."
              : "You are currently subscribed to optional fitness emails."
          }</p>
<form method="post" action="/email-preferences">
<input type="hidden" name="c" value="${escapeAttr(credential ?? "")}" />
<input type="hidden" name="action" value="${unsubscribed ? "resubscribe" : "unsubscribe"}" />
<button type="submit" style="display:inline-block;padding:0.75rem 1.25rem;background:#111111;color:#ffffff;border:0;border-radius:0.375rem;font-weight:600;font-size:1rem;cursor:pointer;">${
            unsubscribed ? "Resubscribe to optional emails" : "Unsubscribe from optional emails"
          }</button>
</form>
<p style="margin:1.5rem 0 0 0;font-size:0.8125rem;color:#555555;">This only changes optional fitness emails. Your saved plan and your plan access stay exactly as they are.</p>`,
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
        const nowIso = new Date().toISOString();
        await supabaseAdmin
          .from("lead_plans")
          .update({ marketing_unsubscribed_at: action === "unsubscribe" ? nowIso : null })
          .eq("id", leadPlanId);
        await supabaseAdmin.from("canonical_events").insert({
          event_name:
            action === "unsubscribe" ? "marketing_unsubscribed" : "marketing_resubscribed",
          lead_plan_id: leadPlanId,
          occurred_at: nowIso,
        });

        return shell(
          `<h1 style="font-size:1.5rem;font-weight:600;margin:0 0 0.75rem 0;">Preferences Updated</h1>
<p style="margin:0 0 1.5rem 0;color:#555555;">${
            action === "unsubscribe"
              ? "You will no longer receive optional fitness emails."
              : "You will receive optional fitness emails again."
          } Your saved plan access is unchanged.</p>
<p style="margin:0;"><a href="/your-plan" style="display:inline-block;padding:0.75rem 1.25rem;background:#111111;color:#ffffff;text-decoration:none;border-radius:0.375rem;font-weight:600;">Go to My Plan</a></p>`,
        );
      },
    },
  },
});
