import { describe, expect, it } from "vitest";

import { handleLeadIntakeHandoff } from "@/lib/lead-intake-handoff.server";

function request(body: URLSearchParams, contentType = "application/x-www-form-urlencoded") {
  return new Request("https://app.genxjumps.com/start/7-day", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

describe("website lead-intake handoff", () => {
  it("stores a validated consented draft on the app origin and starts the assessment", async () => {
    const response = await handleLeadIntakeHandoff(
      request(
        new URLSearchParams({
          firstName: "  Todd  ",
          email: "Todd@Example.com",
          consentGranted: "true",
        }),
      ),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(html).toContain('sessionStorage.setItem("gxj_lead_intake_v1"');
    expect(html).toContain("Todd@Example.com");
    expect(html).toContain('location.replace("/assessment/start")');
    expect(html).not.toContain("?email=");
  });

  it("rejects missing consent without reflecting submitted personal data", async () => {
    const response = await handleLeadIntakeHandoff(
      request(
        new URLSearchParams({
          firstName: "Todd",
          email: "private@example.com",
        }),
      ),
    );
    const html = await response.text();

    expect(response.status).toBe(400);
    expect(html).not.toContain("private@example.com");
  });

  it("rejects non-form requests", async () => {
    const response = await handleLeadIntakeHandoff(
      request(new URLSearchParams(), "application/json"),
    );

    expect(response.status).toBe(415);
  });
});
