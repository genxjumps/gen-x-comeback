// Scanner-safe /return handler.
// GET renders a static page and verifies nothing. Only a deliberate POST
// exchange verifies the token, creates the sessions, and redirects.
import { createFileRoute } from "@tanstack/react-router";
import { RETURN_SESSION_COOKIE } from "@/lib/email/types";
import { renderStaticPage } from "@/lib/static-page";

function shell(body: string): Response {
  return new Response(renderStaticPage("Open My Plan | Gen X Jumps", body), {
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

/** One generic response for invalid, expired, revoked, malformed, and replaced tokens. */
function genericRecovery(): Response {
  return shell(
    `<h1 class="gxj-title">This Link No Longer Works</h1>
<p class="gxj-copy">This plan link is not usable. Links stop working after 30 days or once a newer plan replaces an older one.</p>
<div class="gxj-actions"><a class="gxj-button" href="/recover">Get Back to Your Plan</a></div>`,
  );
}

export const Route = createFileRoute("/return")({
  server: {
    handlers: {
      // A raw GET, prefetch, email-security scan, or provider click reaches only
      // this. Nothing is verified here and nothing submits on its own: the
      // visitor must deliberately press the button.
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        return shell(
          `<h1 class="gxj-title">Opening Your Plan</h1>
<p class="gxj-copy">Press the button below to open your saved 7-day plan and your latest progress.</p>
<form method="post" action="/return" id="return-form" class="gxj-form">
<input type="hidden" name="token" value="${escapeAttr(token)}" />
<button type="submit" class="gxj-button">Open My Plan</button>
</form>`,
        );
      },

      POST: async ({ request }) => {
        // Best-effort throttle so an exchange endpoint cannot be brute forced.
        const { callerBucketKey, consumeRateLimit } = await import("@/lib/email/rate-limit.server");
        const allowed = await consumeRateLimit(callerBucketKey("return_post", request), 300, 20);
        if (!allowed.allowed) return genericRecovery();

        const form = await request.formData();
        const raw = form.get("token");
        const token = typeof raw === "string" ? raw : null;

        const { exchangeReturnToken } = await import("@/lib/email/return-exchange.server");
        const result = await exchangeReturnToken(token);
        if (!result.ok) return genericRecovery();

        const maxAge = Math.max(0, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000));
        const destination = result.platformAuthTokenHash
          ? `${result.destination}#gxj_auth=${encodeURIComponent(result.platformAuthTokenHash)}`
          : result.destination;

        // 303 to a clean path plus an optional URL fragment. The opaque return
        // token is gone before the app loads, and the Supabase token hash in the
        // fragment is never sent to this server or included in HTTP referrers.
        return new Response(null, {
          status: 303,
          headers: {
            location: destination,
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
            "set-cookie": `${RETURN_SESSION_COOKIE}=${result.sessionToken}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`,
          },
        });
      },
    },
  },
});
