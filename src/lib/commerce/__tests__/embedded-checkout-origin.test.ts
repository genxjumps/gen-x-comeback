import { describe, expect, it } from "vitest";

import {
  allowedEmbeddedCheckoutOrigin,
  embeddedCheckoutAttemptLimit,
} from "../embedded-checkout-origin";

function request(origin?: string) {
  return new Request("https://app.genxjumps.com/api/public/checkout/accelerator/session", {
    method: "POST",
    headers: origin ? { origin } : undefined,
  });
}

describe("embedded checkout website origin", () => {
  it("keeps the public checkout limit bounded while allowing controlled preview retries", () => {
    expect(embeddedCheckoutAttemptLimit("https://genxjumps.com")).toBe(20);
    expect(embeddedCheckoutAttemptLimit("https://approved-preview.vercel.app")).toBe(100);
  });

  it("accepts the production website", () => {
    expect(
      allowedEmbeddedCheckoutOrigin(request("https://genxjumps.com"), { NODE_ENV: "production" }),
    ).toBe("https://genxjumps.com");
  });

  it("accepts only exact configured HTTPS preview origins", () => {
    const environment = {
      NODE_ENV: "production",
      CHECKOUT_WEBSITE_ORIGINS: "https://approved-preview.vercel.app",
    };
    expect(
      allowedEmbeddedCheckoutOrigin(request("https://approved-preview.vercel.app"), environment),
    ).toBe("https://approved-preview.vercel.app");
    expect(
      allowedEmbeddedCheckoutOrigin(request("https://other-preview.vercel.app"), environment),
    ).toBeNull();
  });

  it("rejects missing, malformed, and production localhost origins", () => {
    expect(allowedEmbeddedCheckoutOrigin(request(), { NODE_ENV: "production" })).toBeNull();
    expect(
      allowedEmbeddedCheckoutOrigin(request("https://genxjumps.com.attacker.test"), {
        NODE_ENV: "production",
      }),
    ).toBeNull();
    expect(
      allowedEmbeddedCheckoutOrigin(request("http://localhost:4321"), { NODE_ENV: "production" }),
    ).toBeNull();
  });

  it("permits localhost only outside production", () => {
    expect(
      allowedEmbeddedCheckoutOrigin(request("http://localhost:4321"), { NODE_ENV: "development" }),
    ).toBe("http://localhost:4321");
  });
});
