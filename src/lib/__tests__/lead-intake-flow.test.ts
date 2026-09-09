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
import { controlledTestLeadIntakeAllowed } from "@/lib/lead-intake-handoff.server";
import { CONSENT_COPY } from "@/lib/lead-plan";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const intakeRoute = source("../../routes/intake.7-day.ts");
const welcomeRoute = source("../../routes/welcome.tsx");
const completionRoute = source("../../routes/assessment.complete.tsx");
const leadFunctions = source("../lead.functions.ts");
const handoffServer = source("../lead-intake-handoff.server.ts");

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

  it("allows exact normalized emails configured for controlled testing", () => {
    const previousEmails = process.env["NEW_PLAN_INTAKE_TEST_EMAILS"];
    const previousOrigin = process.env["WEBSITE_ORIGIN"];
    process.env["NEW_PLAN_INTAKE_TEST_EMAILS"] = "allowed@example.com, second-test@example.com";
    process.env["WEBSITE_ORIGIN"] = "https://controlled-preview.example";
    const request = new Request("https://app.genxjumps.com/intake/7-day", {
      headers: { origin: "https://genxjumps.com" },
    });

    try {
      expect(controlledTestLeadIntakeAllowed(" Allowed@example.com ", request)).toBe(true);
      expect(controlledTestLeadIntakeAllowed("second-test@example.com", request)).toBe(true);
      expect(controlledTestLeadIntakeAllowed("somebody-else@example.com", request)).toBe(false);
    } finally {
      if (previousEmails === undefined) delete process.env["NEW_PLAN_INTAKE_TEST_EMAILS"];
      else process.env["NEW_PLAN_INTAKE_TEST_EMAILS"] = previousEmails;
      if (previousOrigin === undefined) delete process.env["WEBSITE_ORIGIN"];
      else process.env["WEBSITE_ORIGIN"] = previousOrigin;
    }
  });

  it("allows configured Gmail plus aliases only from the controlled preview", () => {
    const previousEmails = process.env["NEW_PLAN_INTAKE_TEST_EMAILS"];
    const previousOrigin = process.env["WEBSITE_ORIGIN"];
    process.env["NEW_PLAN_INTAKE_TEST_EMAILS"] =
      "controlled.tester@gmail.com, exact+only@gmail.com";
    process.env["WEBSITE_ORIGIN"] = "https://controlled-preview.example/path";

    const from = (origin: string) =>
      new Request("https://app.genxjumps.com/intake/7-day", { headers: { origin } });

    try {
      expect(
        controlledTestLeadIntakeAllowed(
          "controlled.tester+fresh-1@gmail.com",
          from("https://controlled-preview.example"),
        ),
      ).toBe(true);
      expect(
        controlledTestLeadIntakeAllowed(
          "controlled.tester+fresh-1@gmail.com",
          from("https://genxjumps.com"),
        ),
      ).toBe(false);
      expect(
        controlledTestLeadIntakeAllowed(
          "controlled.tester+fresh-1@gmail.com",
          from("https://app.genxjumps.com"),
        ),
      ).toBe(false);
      expect(
        controlledTestLeadIntakeAllowed(
          "somebody-else+fresh-1@gmail.com",
          from("https://controlled-preview.example"),
        ),
      ).toBe(false);
      expect(
        controlledTestLeadIntakeAllowed(
          "controlled.tester+fresh-1@example.com",
          from("https://controlled-preview.example"),
        ),
      ).toBe(false);
      expect(
        controlledTestLeadIntakeAllowed(
          "exact+only+fresh@gmail.com",
          from("https://controlled-preview.example"),
        ),
      ).toBe(false);
      expect(
        controlledTestLeadIntakeAllowed("exact+only@gmail.com", from("https://genxjumps.com")),
      ).toBe(true);
    } finally {
      if (previousEmails === undefined) delete process.env["NEW_PLAN_INTAKE_TEST_EMAILS"];
      else process.env["NEW_PLAN_INTAKE_TEST_EMAILS"] = previousEmails;
      if (previousOrigin === undefined) delete process.env["WEBSITE_ORIGIN"];
      else process.env["WEBSITE_ORIGIN"] = previousOrigin;
    }
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

  it("automatically scopes closed-intake email testing to the completed controlled plan", () => {
    expect(leadFunctions).toContain("admitControlledPlanEmailScope(result.leadPlanId)");
    expect(leadFunctions).toContain("if (!NEW_PLAN_INTAKE_OPEN)");
    expect(handoffServer).toContain("controlled_lead_plan_id: leadPlanId");
    expect(handoffServer).toContain('.eq("genuine_plans_admitted", false)');
    expect(handoffServer).not.toContain("genuine_plans_admitted: true");
    expect(handoffServer).not.toContain("sending_enabled: true");
  });
});
