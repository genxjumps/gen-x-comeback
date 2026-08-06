// Scanner-safe /return handler.
// GET renders a static page and verifies nothing. Only a deliberate POST
// exchange verifies the token, creates the session, and redirects.
import { createFileRoute } from "@tanstack/react-router";
import { RETURN_SESSION_COOKIE } from "@/lib/email/types";

const PAGE_STYLE =
  "margin:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;line-height:1.6;";

function shell(body: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Open My Plan | Gen X Jumps</title></head>
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

/** One generic response for invalid, expired, revoked, malformed, and replaced tokens. */
function genericRecovery(): Response {
  return shell(
    `<h1 style="font-size:1.5rem;font-weight:600;margin:0 0 0.75rem 0;">This Link No Longer Works</h1>
<p style="margin:0 0 1.5rem 0;color:#555555;">This plan link is not usable. Links stop working after 30 days or once a newer plan replaces an older one.</p>
<p style="margin:0;"><a href="/recover" style="display:inline-block;padding:0.75rem 1.25rem;background:#111111;color:#ffffff;text-decoration:none;border-radius:0.375rem;font-weight:600;">Get Back to Your Plan</a></p>`,
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
          `<h1 style="font-size:1.5rem;font-weight:600;margin:0 0 0.75rem 0;">Opening Your Plan</h1>
<p style="margin:0 0 1.5rem 0;color:#555555;">Press the button below to open your saved 7-day plan and your latest progress.</p>
<form method="post" action="/return" id="return-form">
<input type="hidden" name="token" value="${escapeAttr(token)}" />
<button type="submit" style="display:inline-block;padding:0.75rem 1.25rem;background:#111111;color:#ffffff;border:0;border-radius:0.375rem;font-weight:600;font-size:1rem;cursor:pointer;">Open My Plan</button>
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
        // 303 to a clean URL so the bearer token is gone before the app loads.
        // Destination is the trusted closed value from the exchange, never input.
        return new Response(null, {
          status: 303,
          headers: {
            location: result.destination,
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
            "set-cookie": `${RETURN_SESSION_COOKIE}=${result.sessionToken}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`,
          },
        });
      },
    },
  },
});
