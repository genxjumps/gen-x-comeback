import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";

import {
  LEAD_INTAKE_COOKIE,
  LEAD_INTAKE_TTL_SECONDS,
  WEBSITE_INTAKE_ORIGIN,
  leadIntakeCookie,
  trustedLeadIntakeOrigin,
  websiteLeadIntakeSchema,
} from "@/lib/lead-intake-handoff";
import { CONSENT_COPY, CONSENT_VERSION } from "@/lib/lead-plan";
import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";
import { renderStaticPage } from "@/lib/static-page";

function errorPage(status: number): Response {
  return new Response(
    renderStaticPage(
      "We Couldn’t Start Your Plan | Gen X Jumps",
      `<h1 class="gxj-title">We Couldn’t Start Your Plan</h1>
<p class="gxj-copy">Return to the short signup form and try again. If the problem continues, wait a moment and resubmit.</p>
<div class="gxj-actions"><a class="gxj-button" href="${WEBSITE_INTAKE_ORIGIN}/start-here/">Return to My Signup</a></div>`,
    ),
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "x-robots-tag": "noindex, nofollow",
      },
    },
  );
}

function field(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value : null;
}

export const Route = createFileRoute("/intake/7-day")({
  server: {
    handlers: {
      GET: () => new Response(null, { status: 303, headers: { location: "/start/7-day" } }),
      POST: async ({ request }) => {
        if (!trustedLeadIntakeOrigin(request)) return errorPage(403);

        const { callerBucketKey, consumeRateLimit } = await import("@/lib/email/rate-limit.server");
        const allowed = await consumeRateLimit(callerBucketKey("lead_intake", request), 600, 20);
        if (!allowed.allowed) return errorPage(429);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return errorPage(400);
        }

        const parsed = websiteLeadIntakeSchema.safeParse({
          firstName: field(form, "firstName"),
          email: field(form, "email"),
          consentGranted: field(form, "consentGranted"),
          source: field(form, "source") ?? "website_hero",
          landingPath: field(form, "landingPath"),
          referrerOrigin: field(form, "referrerOrigin"),
          utmSource: field(form, "utmSource"),
          utmMedium: field(form, "utmMedium"),
          utmCampaign: field(form, "utmCampaign"),
          utmContent: field(form, "utmContent"),
        });
        if (!parsed.success) return errorPage(422);

        if (!NEW_PLAN_INTAKE_OPEN) {
          const { controlledTestLeadIntakeAllowed } =
            await import("@/lib/lead-intake-handoff.server");
          if (!controlledTestLeadIntakeAllowed(parsed.data.email)) {
            return new Response(null, { status: 303, headers: { location: "/start/7-day" } });
          }
        }

        try {
          const { createWebsiteLeadIntake } = await import("@/lib/lead-intake-handoff.server");
          const intake = await createWebsiteLeadIntake(parsed.data, {
            copy: CONSENT_COPY,
            version: CONSENT_VERSION,
          });
          const secure = new URL(request.url).protocol === "https:";
          setCookie(LEAD_INTAKE_COOKIE, intake.rawToken, {
            path: "/",
            maxAge: LEAD_INTAKE_TTL_SECONDS,
            secure,
            httpOnly: true,
            sameSite: "lax",
          });

          return new Response(null, {
            status: 303,
            headers: {
              location: "/welcome",
              "cache-control": "no-store",
              "referrer-policy": "no-referrer",
              "set-cookie": leadIntakeCookie(intake.rawToken, LEAD_INTAKE_TTL_SECONDS, secure),
            },
          });
        } catch {
          return errorPage(503);
        }
      },
    },
  },
});
