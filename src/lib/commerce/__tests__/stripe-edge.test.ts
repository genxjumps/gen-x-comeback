import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmStripeEdgeCheckout,
  confirmStripeEdgeGuestCheckout,
  createStripeEdgeCheckout,
  createStripeEdgeGuestCheckout,
  forwardStripeWebhookToEdge,
  getStripeEdgeAvailability,
  getStripeEdgeGuestAvailability,
  readStripeEdgeRuntimeConfig,
} from "../stripe-edge.server";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

function mockEdge(payload: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(payload, { status }));
}

describe("Stripe edge runtime adapter", () => {
  it("uses the existing Lovable Cloud runtime connection instead of custom hosting secrets", () => {
    expect(readStripeEdgeRuntimeConfig()).toEqual({
      endpoint: "https://project.supabase.co/functions/v1/accelerator-stripe",
      serviceRoleKey: "sb_secret_test",
    });
  });

  it("returns the safe backend availability result", async () => {
    const fetchMock = mockEdge({
      ok: true,
      enabled: true,
      allowed: true,
      owned: false,
      priceCents: 3700,
      issue: null,
    });
    const result = await getStripeEdgeAvailability({
      customerAccountId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result).toMatchObject({ ok: true, enabled: true, allowed: true, owned: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/accelerator-stripe",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer sb_secret_test" }),
      }),
    );
  });

  it("fails closed when availability cannot reach the backend", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(
      await getStripeEdgeAvailability({
        customerAccountId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toMatchObject({ ok: true, enabled: false, allowed: false });
  });

  it("reads the separate guest-checkout gate without requiring a customer account", async () => {
    mockEdge({ ok: true, enabled: true, priceCents: 3700, issue: null });
    expect(await getStripeEdgeGuestAvailability()).toEqual({
      ok: true,
      enabled: true,
      priceCents: 3700,
      issue: null,
    });
  });

  it("accepts only Stripe-hosted checkout URLs", async () => {
    mockEdge({ ok: true, checkoutUrl: "https://checkout.stripe.com/c/pay/test" });
    expect(
      await createStripeEdgeCheckout({
        customerAccountId: "00000000-0000-4000-8000-000000000001",
        email: "buyer@example.com",
      }),
    ).toEqual({ ok: true, checkoutUrl: "https://checkout.stripe.com/c/pay/test" });
  });

  it("rejects a malformed checkout redirect returned by the backend", async () => {
    mockEdge({ ok: true, checkoutUrl: "https://example.com/not-stripe" });
    expect(
      await createStripeEdgeCheckout({
        customerAccountId: "00000000-0000-4000-8000-000000000001",
        email: "buyer@example.com",
      }),
    ).toEqual({ ok: false, reason: "unavailable" });
  });

  it("keeps the guest claim server-side while accepting only Stripe checkout URLs", async () => {
    const claimToken = "a".repeat(64);
    mockEdge({
      ok: true,
      checkoutUrl: "https://checkout.stripe.com/c/pay/guest",
      claimToken,
    });
    expect(await createStripeEdgeGuestCheckout()).toEqual({
      ok: true,
      checkoutUrl: "https://checkout.stripe.com/c/pay/guest",
      claimToken,
    });
  });

  it("confirms an edge-verified entitlement", async () => {
    mockEdge({ ok: true, entitlementId: "00000000-0000-4000-8000-000000000002" });
    expect(
      await confirmStripeEdgeCheckout({
        customerAccountId: "00000000-0000-4000-8000-000000000001",
        sessionId: "cs_test_verified",
      }),
    ).toEqual({
      ok: true,
      authTokenHash: null,
      entitlementId: "00000000-0000-4000-8000-000000000002",
    });
  });

  it("returns a one-time auth handoff only after the guest claim is confirmed", async () => {
    mockEdge({
      ok: true,
      authTokenHash: "hashed-auth-token-for-the-paid-browser",
      entitlementId: "00000000-0000-4000-8000-000000000002",
    });
    expect(
      await confirmStripeEdgeGuestCheckout({
        claimToken: "b".repeat(64),
        sessionId: "cs_test_verified",
      }),
    ).toEqual({
      ok: true,
      authTokenHash: "hashed-auth-token-for-the-paid-browser",
      entitlementId: "00000000-0000-4000-8000-000000000002",
    });
  });

  it("preserves webhook response status for provider retries", async () => {
    mockEdge({ error: "fulfillment_failed" }, 500);
    const response = await forwardStripeWebhookToEdge({
      rawBody: "raw",
      signature: "signed",
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "fulfillment_failed" });
  });
});
