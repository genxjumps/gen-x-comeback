import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseLeadIntakeDraft, validEmail, validFirstName } from "@/lib/lead-intake-draft";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("website-to-7-day intake", () => {
  it("validates and normalizes a complete front-of-flow signup", () => {
    expect(
      parseLeadIntakeDraft({
        firstName: "  Todd ",
        email: " todd@example.com ",
        consentGranted: true,
      }),
    ).toEqual({ firstName: "Todd", email: "todd@example.com", consentGranted: true });
    expect(validFirstName(" ")).toBe(false);
    expect(validEmail("not-an-email")).toBe(false);
  });

  it("rejects missing consent and malformed stored values", () => {
    expect(
      parseLeadIntakeDraft({
        firstName: "Todd",
        email: "todd@example.com",
        consentGranted: false,
      }),
    ).toBeNull();
    expect(parseLeadIntakeDraft("bad draft")).toBeNull();
  });

  it("routes new website traffic directly to signup and preserves one enrollment transaction", () => {
    const home = readSource("../../routes/index.tsx");
    const signup = readSource("../../routes/start.7-day.tsx");
    const complete = readSource("../../routes/assessment.complete.tsx");

    expect(home).toContain('const ctaTo = hasPlan ? "/your-plan" : "/start/7-day"');
    expect(signup).toContain('createFileRoute("/start/7-day")');
    expect(signup).toContain('navigate({ to: "/assessment/start" })');
    expect(complete).toContain("readLeadIntakeDraft()");
    expect(complete).toContain("await save({");
    expect(complete).toContain("clearLeadIntakeDraft()");
    expect(complete).toContain('navigate({ to: "/your-plan", replace: true })');
    expect(complete).toContain("frontEnrollmentAttempted.current");
  });
});
