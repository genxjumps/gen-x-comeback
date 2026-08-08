// Scanner-safe /recover handler: on-demand transactional product access.
//
// GET renders a static form and verifies nothing. Only a deliberate POST records
// a recovery request, and every possible outcome returns exactly the same
// visible response so nothing about account, email, or plan existence leaks.
import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage } from "@/lib/static-page";

/** Approved customer-facing form copy. */
export const RECOVER_HEADING = "Get Back to Your Plan";
export const RECOVER_COPY = "Enter the email you used and I’ll send you a fresh link.";

/**
 * Exact subordinate consent disclosure rendered beneath the Recovery action.
 * A successful Recovery may re-activate Gen X Jumps 7-Day Plan email consent;
 * it never touches general Gen X Jumps marketing consent.
 */
export const RECOVER_CONSENT_DISCLOSURE =
  "By recovering your plan, you agree to receive Gen X Jumps 7-Day Plan emails.";

/** The single generic response for every possible outcome. */
export const RECOVER_GENERIC_RESPONSE =
  "If that email matches a Gen X Jumps plan, a new link is on the way.";

/** Shared database-backed abuse limits. */
const EMAIL_WINDOW_SECONDS = 3600;
const EMAIL_LIMIT = 3;
const CALLER_WINDOW_SECONDS = 3600;
const CALLER_LIMIT = 5;

function shell(body: string): Response {
  return new Response(renderStaticPage("Get Back to Your Plan | Gen X Jumps", body), {
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

/** One identical acknowledgement for match, unknown, malformed, rate-limited, suppressed, queued, and replay. */
function genericAcknowledgement(): Response {
  return shell(
    `<h1 class="gxj-title">${RECOVER_HEADING}</h1>
<p class="gxj-copy">${RECOVER_GENERIC_RESPONSE}</p>`,
  );
}

/**
 * Narrowest structural view of the service-role client used here. The RPC is
 * invoked as a method on the client object so the SDK keeps its own receiver
 * context; the generated Supabase types are protected and do not describe this
 * function, so only this local shape is asserted.
 */
type RecoveryRpcClient = {
  rpc(
    fn: "request_plan_recovery",
    args: { p_email_normalized: string; p_request_id: string },
  ): PromiseLike<{ error: { code?: string | null } | null }>;
};

/** Conservative allowlist so no database text can reach a server log. */
function sanitizeErrorCode(code: unknown): string {
  return typeof code === "string" && /^[A-Za-z0-9_]{1,12}$/.test(code) ? code : "unknown";
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
          `<h1 class="gxj-title">${RECOVER_HEADING}</h1>
<p class="gxj-copy">${RECOVER_COPY}</p>
<form method="post" action="/recover" id="recover-form" class="gxj-form">
<input type="hidden" name="request_id" value="${escapeAttr(requestId)}" />
<label class="gxj-label" for="recover-email">Email</label>
<input class="gxj-input" type="email" id="recover-email" name="email" required autocomplete="email" inputmode="email" maxlength="254" />
<button type="submit" class="gxj-button">Send My Link</button>
<p class="gxj-note">${RECOVER_CONSENT_DISCLOSURE}</p>
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
          // is idempotent for one validated request id. The call must stay a
          // method call on the client: a detached `rpc` reference loses the SDK
          // receiver and throws before any request is made.
          const client = supabaseAdmin as unknown as RecoveryRpcClient;
          const { error } = await client.rpc("request_plan_recovery", {
            p_email_normalized: emailNormalized,
            p_request_id: requestId,
          });
          if (error) {
            // Server-only, redacted: stable classification and sanitized code only.
            console.error(`recovery_rpc_error code=${sanitizeErrorCode(error.code)}`);
          }
        } catch {
          // An infrastructure failure must not change the visible response.
          console.error("recovery_rpc_exception");
        }

        return genericAcknowledgement();
      },
    },
  },
});
