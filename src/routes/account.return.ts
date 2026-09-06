// Scanner-safe paid-access return. GET verifies nothing. A deliberate POST
// validates the reusable credential and creates a fresh browser Auth handoff.
import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage } from "@/lib/static-page";

function shell(body: string): Response {
  return new Response(renderStaticPage("Open My Programs | Gen X Jumps", body), {
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

function unusable(): Response {
  return shell(
    `<h1 class="gxj-title">This Link No Longer Works</h1>
<p class="gxj-copy">This access link is not usable. Request a fresh link and try again.</p>
<div class="gxj-actions"><a class="gxj-button" href="/recover">Send Me a Fresh Link</a></div>`,
  );
}

export const Route = createFileRoute("/account/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        return shell(
          `<h1 class="gxj-title">Open Your Gen X Jumps Programs</h1>
<p class="gxj-copy">Press the button below to securely open the programs you own.</p>
<form method="post" action="/account/return" id="paid-access-return-form" class="gxj-form">
<input type="hidden" name="token" value="${escapeAttr(token)}" />
<button type="submit" class="gxj-button">Open My Programs</button>
</form>`,
        );
      },

      POST: async ({ request }) => {
        const { callerBucketKey, consumeRateLimit } = await import("@/lib/email/rate-limit.server");
        const allowed = await consumeRateLimit(
          callerBucketKey("paid_access_return", request),
          300,
          20,
        );
        if (!allowed.allowed) return unusable();

        const form = await request.formData();
        const value = form.get("token");
        const token = typeof value === "string" ? value : null;
        const { exchangePaidAccessToken } =
          await import("@/lib/account/paid-access-exchange.server");
        const result = await exchangePaidAccessToken(token);
        if (!result.ok) return unusable();

        return new Response(null, {
          status: 303,
          headers: {
            location: `${result.destination}#gxj_auth=${encodeURIComponent(result.platformAuthTokenHash)}`,
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
          },
        });
      },
    },
  },
});
