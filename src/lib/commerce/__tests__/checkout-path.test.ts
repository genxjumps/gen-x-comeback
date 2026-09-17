import { describe, expect, it } from "vitest";
import { checkoutPath } from "../checkout-path";
import type { CheckoutAvailabilityResult } from "../functions";

const account: Extract<CheckoutAvailabilityResult, { ok: true }> = {
  ok: true,
  allowed: true,
  enabled: true,
  owned: false,
  priceCents: 3700,
  issue: null,
};

describe("completion-to-checkout identity", () => {
  it("waits for account evidence even when guest checkout is enabled", () => {
    expect(checkoutPath(null, true)).toBe("loading");
  });
  it("uses the authenticated purchase path for an eligible customer", () => {
    expect(checkoutPath(account, true)).toBe("account");
  });
  it("does not offer a second purchase to an existing owner", () => {
    expect(checkoutPath({ ...account, owned: true }, true)).toBe("owned");
  });
  it("never bypasses account controls with a guest checkout", () => {
    expect(checkoutPath({ ...account, allowed: false }, true)).toBe("closed");
    expect(checkoutPath({ ...account, enabled: false }, true)).toBe("closed");
  });
  it("retains explicitly enabled guest checkout when no account is signed in", () => {
    expect(checkoutPath({ ok: false, issue: "account_unavailable" }, true)).toBe("guest");
    expect(checkoutPath({ ok: false, issue: "account_unavailable" }, false)).toBe("closed");
  });
});
