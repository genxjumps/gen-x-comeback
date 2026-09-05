import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StripeCheckoutConfig } from "../stripe-config.server";
import {
  constructStripeWebhookEvent,
  createAcceleratorCheckoutSession,
  fulfillAcceleratorCheckout,
} from "../stripe-checkout.server";

const { provision, entitlementLimit } = vi.hoisted(() => ({
  provision: vi.fn(),
  entitlementLimit: vi.fn(),
}));

vi.mock("@/lib/accelerator/provision.server", () => ({
  provisionAcceleratorOwnership: provision,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ limit: entitlementLimit }),
          }),
        }),
      }),
    }),
  },
}));

const CUSTOMER_ID = "00000000-0000-4000-8000-000000000001";
const CONFIG: StripeCheckoutConfig = {
  appOrigin: "https://app.genxjumps.com",
  allowedCustomerIds: new Set([CUSTOMER_ID]),
  priceId: "price_accelerator_28_test",
  secretKey: "sk_test_not_real",
  webhookSecret: "whsec_not_real",
};

function acceleratorPrice() {
  return {
    id: CONFIG.priceId,
    livemode: false,
    active: true,
    type: "one_time",
    unit_amount: 3700,
    currency: "usd",
    product: {
      id: "prod_accelerator_28_test",
      object: "product",
      active: true,
      deleted: false,
      metadata: {
        genx_product_code: "accelerator_28",
        genx_program_version: "accelerator_28_v1",
      },
    },
  } as unknown as Stripe.Price;
}

function paidSession() {
  return {
    id: "cs_test_verified_purchase",
    livemode: false,
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    amount_total: 3700,
    currency: "usd",
    client_reference_id: CUSTOMER_ID,
    metadata: {
      customer_account_id: CUSTOMER_ID,
      genx_product_code: "accelerator_28",
      genx_program_version: "accelerator_28_v1",
    },
    line_items: { data: [{ quantity: 1, price: acceleratorPrice() }] },
    payment_intent: {
      latest_charge: { created: 1_788_570_000, paid: true },
    },
  } as unknown as Stripe.Checkout.Session;
}

function stripeMock() {
  const priceRetrieve = vi.fn().mockResolvedValue(acceleratorPrice());
  const sessionCreate = vi.fn().mockResolvedValue({
    id: "cs_test_new",
    url: "https://checkout.stripe.com/c/pay/cs_test_new",
  });
  const sessionRetrieve = vi.fn().mockResolvedValue(paidSession());
  const constructEventAsync = vi.fn().mockResolvedValue({
    id: "evt_test_signed",
    type: "checkout.session.completed",
  });
  return {
    client: {
      prices: { retrieve: priceRetrieve },
      checkout: { sessions: { create: sessionCreate, retrieve: sessionRetrieve } },
      webhooks: { constructEventAsync },
    } as unknown as Stripe,
    constructEventAsync,
    priceRetrieve,
    sessionCreate,
    sessionRetrieve,
  };
}

describe("Accelerator Stripe Checkout", () => {
  beforeEach(() => {
    entitlementLimit.mockReset().mockResolvedValue({ data: [], error: null });
    provision.mockReset().mockResolvedValue({
      purchaseId: "purchase-1",
      entitlementId: "entitlement-1",
      replayed: false,
    });
  });

  it("creates only the locked one-time test checkout for an admitted account", async () => {
    const stripe = stripeMock();
    const result = await createAcceleratorCheckoutSession({
      account: { id: CUSTOMER_ID, email: "controlled@example.com" },
      config: CONFIG,
      stripe: stripe.client,
    });

    expect(result.url).toContain("checkout.stripe.com");
    expect(stripe.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: CONFIG.priceId, quantity: 1 }],
        client_reference_id: CUSTOMER_ID,
        success_url:
          "https://app.genxjumps.com/checkout/accelerator/success?session_id={CHECKOUT_SESSION_ID}",
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(
          new RegExp(`^accelerator-checkout-${CUSTOMER_ID}-\\d+$`),
        ),
      }),
    );
  });

  it("refuses checkout for an account that already owns the product", async () => {
    entitlementLimit.mockResolvedValue({ data: [{ id: "entitlement-1" }], error: null });
    const stripe = stripeMock();
    await expect(
      createAcceleratorCheckoutSession({
        account: { id: CUSTOMER_ID, email: "controlled@example.com" },
        config: CONFIG,
        stripe: stripe.client,
      }),
    ).rejects.toThrow("already owns");
    expect(stripe.sessionCreate).not.toHaveBeenCalled();
  });

  it("provisions permanent ownership only after retrieving a matching paid session", async () => {
    const stripe = stripeMock();
    const result = await fulfillAcceleratorCheckout({
      config: CONFIG,
      expectedCustomerAccountId: CUSTOMER_ID,
      sessionId: "cs_test_verified_purchase",
      stripe: stripe.client,
    });

    expect(result.entitlementId).toBe("entitlement-1");
    expect(provision).toHaveBeenCalledWith({
      customerAccountId: CUSTOMER_ID,
      idempotencyKey: "cs_test_verified_purchase",
      purchaseSource: "stripe_checkout",
      sourceReference: "cs_test_verified_purchase",
      purchasedAt: new Date(1_788_570_000_000).toISOString(),
    });
  });

  it("rejects a mismatched customer before provisioning", async () => {
    const stripe = stripeMock();
    await expect(
      fulfillAcceleratorCheckout({
        config: CONFIG,
        expectedCustomerAccountId: "00000000-0000-4000-8000-000000000002",
        sessionId: "cs_test_verified_purchase",
        stripe: stripe.client,
      }),
    ).rejects.toThrow("does not match");
    expect(provision).not.toHaveBeenCalled();
  });

  it("rejects an unpaid session before provisioning", async () => {
    const stripe = stripeMock();
    stripe.sessionRetrieve.mockResolvedValue({
      ...paidSession(),
      payment_status: "unpaid",
    });
    await expect(
      fulfillAcceleratorCheckout({
        config: CONFIG,
        sessionId: "cs_test_verified_purchase",
        stripe: stripe.client,
      }),
    ).rejects.toThrow("does not match");
    expect(provision).not.toHaveBeenCalled();
  });

  it("uses asynchronous signature verification for the deployed worker runtime", async () => {
    const stripe = stripeMock();
    const event = await constructStripeWebhookEvent({
      config: CONFIG,
      rawBody: "raw-provider-body",
      signature: "signed-test-header",
      stripe: stripe.client,
    });

    expect(event.type).toBe("checkout.session.completed");
    expect(stripe.constructEventAsync).toHaveBeenCalledWith(
      "raw-provider-body",
      "signed-test-header",
      CONFIG.webhookSecret,
    );
  });
});
