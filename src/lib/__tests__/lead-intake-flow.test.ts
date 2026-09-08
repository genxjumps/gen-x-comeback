import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  LEAD_INTAKE_COOKIE,
  LEAD_INTAKE_TTL_SECONDS,
  leadIntakeCookie,
  trustedLeadIntakeOrigin,
  websiteLeadIntakeSchema,
} from "@/lib/lead-intake-handoff";
import { CONSENT_COPY } from "@/lib/lead-plan";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const intakeRoute = source("../../routes/intake.7-day.ts");
const welcomeRoute = source("../../routes/welcome.tsx");
const completionRoute = source("../../routes/assessment.complete.tsx");

describe("website lead intake handoff", () => {
  it("accepts the approved first-name, email, and explicit-consent payload", () => {
    const parsed = websiteLeadIntakeSchema.safeParse({
      firstName: "  Todd  ",
      email: " TODD@example.com ",
      consentGranted: "true",
      source: "website_hero",
      landingPath: "/start-here/",
      referrerOrigin: null,
      utmSource: "newsletter",
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.firstName).toBe("Todd");
      expect(parsed.data.email).toBe("TODD@example.com");
    }
  });

  it("rejects missing consent, invalid email, and markup in a name", () => {
    const base = {
      firstName: "Todd",
      email: "todd@example.com",
      consentGranted: "true",
      source: "website_hero",
    };
    expect(websiteLeadIntakeSchema.safeParse({ ...base, consentGranted: "false" }).success).toBe(
      false,
    );
    expect(websiteLeadIntakeSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(
      false,
    );
    expect(websiteLeadIntakeSchema.safeParse({ ...base, firstName: "<Todd>" }).success).toBe(false);
  });

  it("uses the exact approved marketing consent disclosure", () => {
    expect(CONSENT_COPY).toBe(
      "By signing up for the free 7-Day Plan, I agree to receive plan-related emails and occasional marketing emails from Gen X Jumps. I can unsubscribe at any time.",
    );
  });

  it("allows the production website and same-origin requests but rejects impostors", () => {
    expect(
      trustedLeadIntakeOrigin(
        new Request("https://app.genxjumps.com/intake/7-day", {
          headers: { origin: "https://genxjumps.com" },
        }),
      ),
    ).toBe(true);
    expect(
      trustedLeadIntakeOrigin(
        new Request("https://app.genxjumps.com/intake/7-day", {
          headers: { origin: "https://app.genxjumps.com" },
        }),
      ),
    ).toBe(true);
    expect(
      trustedLeadIntakeOrigin(
        new Request("https://app.genxjumps.com/intake/7-day", {
          headers: { origin: "https://genxjumps.example" },
        }),
      ),
    ).toBe(false);
  });

  it("sets a short-lived, HTTP-only, same-site handoff cookie", () => {
    const cookie = leadIntakeCookie("opaque-token", LEAD_INTAKE_TTL_SECONDS);
    expect(cookie).toContain(`${LEAD_INTAKE_COOKIE}=opaque-token`);
    expect(cookie).toContain("Max-Age=86400");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("redirects a valid intake to the brief personalized welcome screen", () => {
    expect(intakeRoute).toContain('location: "/welcome"');
    expect(welcomeRoute).toContain("Access saved");
    expect(welcomeRoute).toContain("Quick setup");
    expect(welcomeRoute).toContain("Plan ready");
    expect(welcomeRoute).toContain("Build My 7-Day Plan");
    expect(welcomeRoute).toContain("About 2 minutes. No password required.");
  });

  it("finishes without a second identity form and sends new participants to plan-ready", () => {
    expect(completionRoute).toContain("saveLeadPlanFromHandoff");
    expect(completionRoute).toContain('navigate({ to: "/plan-ready", replace: true })');
    expect(completionRoute).not.toContain('htmlFor="firstName"');
    expect(completionRoute).not.toContain('htmlFor="email"');
  });
});
