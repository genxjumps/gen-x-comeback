import { createFileRoute } from "@tanstack/react-router";
import { RAW_TOKEN_RE, generateAccessToken, hashAccessToken } from "@/lib/lead-plan";
import { LEAD_INTAKE_COOKIE, leadIntakeCookie } from "@/lib/lead-intake-handoff";
import { renderStaticPage } from "@/lib/static-page";

function page(body: string): Response {
  return new Response(renderStaticPage("Continue Your 7-Day Plan | Gen X Jumps", body), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}
function recover(): Response {
  return page(
    `<h1 class="gxj-title">Let's Get You Back In</h1><p class="gxj-copy">This link couldn't be opened. Request a new welcome link using the same email. Your saved plan won't be replaced.</p><div class="gxj-actions"><a class="gxj-button" href="https://genxjumps.com/start-here/#seven-day-optin">Get a New Welcome Link</a></div>`,
  );
}
export const Route = createFileRoute("/signup/return")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!RAW_TOKEN_RE.test(token)) return recover();
        // GET/prefetch/scanners never exchange credentials or restart a plan.
        return page(
          `<h1 class="gxj-title">Continue Your 7-Day Plan</h1><p class="gxj-copy">Open your secure access to pick up where you left off.</p><form method="post" action="/signup/return" class="gxj-form"><input type="hidden" name="token" value="${token}" /><button class="gxj-button" type="submit">Continue My Plan</button></form>`,
        );
      },
      POST: async ({ request }) => {
        if (request.headers.get("origin") !== new URL(request.url).origin) return recover();
        const { consumeRateLimit, callerBucketKey } = await import("@/lib/email/rate-limit.server");
        if (!(await consumeRateLimit(callerBucketKey("signup_return", request), 300, 20)).allowed)
          return recover();
        try {
          const form = await request.formData();
          const token = form.get("token");
          if (typeof token !== "string" || !RAW_TOKEN_RE.test(token)) return recover();
          const { signupRpc } = await import("@/lib/signup-recovery.server");
          const raw = generateAccessToken();
          const ok = await signupRpc<boolean>("exchange_signup_welcome", {
            p_email_token_hash: await hashAccessToken(token),
            p_session_hash: await hashAccessToken(raw),
          });
          if (!ok) return recover();
          const maxAge = 30 * 86400;
          const { setCookie } = await import("@tanstack/react-start/server");
          setCookie(LEAD_INTAKE_COOKIE, raw, {
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge,
          });
          return new Response(null, {
            status: 303,
            headers: {
              location: "/welcome",
              "cache-control": "no-store",
              "referrer-policy": "no-referrer",
              "set-cookie": leadIntakeCookie(raw, maxAge),
            },
          });
        } catch {
          return recover();
        }
      },
    },
  },
});
