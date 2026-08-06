// Scanner-safe /recover handler: on-demand transactional product access.
//
// GET renders a static form and verifies nothing. Only a deliberate POST records
// a recovery request, and every possible outcome returns exactly the same
// visible response so nothing about account, email, or plan existence leaks.
import { createFileRoute } from "@tanstack/react-router";

const PAGE_STYLE =
  "margin:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;line-height:1.6;";

/** Approved customer-facing form copy. */
export const RECOVER_HEADING = "Get Back to Your Plan";
export const RECOVER_COPY = "Enter the email you used and I’ll send you a fresh link.";

/** The single generic response for every possible outcome. */
export const RECOVER_GENERIC_RESPONSE =
  "If that email matches a Gen X Jumps plan, a new link is on the way.";

/** Shared database-backed abuse limits. */
const EMAIL_WINDOW_SECONDS = 3600;
const EMAIL_LIMIT = 3;
const CALLER_WINDOW_SECONDS = 3600;
const CALLER_LIMIT = 5;

function shell(body: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Get Back to Your Plan | Gen X Jumps</title></head>
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

/** One identical acknowledgement for match, unknown, malformed, rate-limited, suppressed, queued, and replay. */
function genericAcknowledgement(): Response {
  return shell(
    `<h1 style="font-size:1.5rem;font-weight:600;margin:0 0 0.75rem 0;">${RECOVER_HEADING}</h1>
<p style="margin:0;color:#555555;">${RECOVER_GENERIC_RESPONSE}</p>`,
  );
}

export const Route = createFileRoute("/recover")({
  server: {
    handlers: {
      // A raw GET, prefetch, or email-security scan reaches only this. Nothing is
      // verified, nothing is recorded, and nothing submits on its own.
      GET: async () => {
        const { readEmailTokenSecret } = await import("@/lib/email/credentials.server");
        const { issueRecoveryRequestId } = await import("@/lib/email/recovery-request.server");
        const secret = readEmailTokenSecret();
        const requestId = secret ? issueRecoveryRequestId(secret) : "";

        return shell(
          `<h1 style="font-size:1.5rem;font-weight:600;margin:0 0 0.75rem 0;">${RECOVER_HEADING}</h1>
<p style="margin:0 0 1.5rem 0;color:#555555;">${RECOVER_COPY}</p>
<form method="post" action="/recover" id="recover-form">
<input type="hidden" name="request_id" value="${escapeAttr(requestId)}" />
<label for="recover-email" style="display:block;margin:0 0 0.375rem 0;font-size:0.875rem;font-weight:600;">Email</label>
<input type="email" id="recover-email" name="email" required autocomplete="email" inputmode="email" maxlength="254" style="display:block;width:100%;box-sizing:border-box;padding:0.75rem;margin:0 0 1rem 0;border:1px solid #cccccc;border-radius:0.375rem;font-size:1rem;" />
<button type="submit" style="display:inline-block;padding:0.75rem 1.25rem;background:#111111;color:#ffffff;border:0;border-radius:0.375rem;font-weight:600;font-size:1rem;cursor:pointer;">Send My Link</button>
</form>`,
        );
      },

      POST: async ({ request }) => {
        const form = await request.formData();

        const { readEmailTokenSecret } = await import("@/lib/email/credentials.server");
        const secret = readEmailTokenSecret();
        if (!secret) return genericAcknowledgement();

        const { callerBucketKey, consumeRateLimit } = await import("@/lib/email/rate-limit.server");
        const { normalizeSubmittedEmail, recoveryEmailBucketKey, verifyRecoveryRequestId } =
          await import("@/lib/email/recovery-request.server");

        // Caller/IP limit uses the shared privacy-preserving helper: 5 per hour.
        const caller = await consumeRateLimit(
          callerBucketKey("recover_post", request),
          CALLER_WINDOW_SECONDS,
          CALLER_LIMIT,
        );
        if (!caller.allowed) return genericAcknowledgement();

        const emailNormalized = normalizeSubmittedEmail(form.get("email"));
        if (!emailNormalized) return genericAcknowledgement();

        // Per-email limit: 3 per hour, keyed by an HMAC so the bucket key never
        // contains the raw address.
        const perEmail = await consumeRateLimit(
          recoveryEmailBucketKey(secret, emailNormalized),
          EMAIL_WINDOW_SECONDS,
          EMAIL_LIMIT,
        );
        if (!perEmail.allowed) return genericAcknowledgement();

        const requestId = verifyRecoveryRequestId(secret, form.get("request_id"));
        if (!requestId) return genericAcknowledgement();

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // Service-role-only atomic boundary. It returns nothing identifying and
          // is idempotent for one validated request id.
          const rpc = supabaseAdmin.rpc as unknown as (
            fn: string,
            args: Record<string, string>,
          ) => Promise<{ error: { message: string } | null }>;
          await rpc("request_plan_recovery", {
            p_email_normalized: emailNormalized,
            p_request_id: requestId,
          });
        } catch {
          // An infrastructure failure must not change the visible response.
        }

        return genericAcknowledgement();
      },
    },
  },
});
