import { afterEach, describe, expect, it } from "vitest";

import { readStripeCheckoutConfig, stripeCheckoutConfigIssue } from "../stripe-config.server";

const ORIGINAL_ENV = { ...process.env };

function validEnvironment() {
  process.env = {
    ...ORIGINAL_ENV,
    APP_ORIGIN: "https://app.genxjumps.com",
    STRIPE_ACCELERATOR_PRICE_ID: "price_test_accelerator",
    STRIPE_CHECKOUT_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_test_not_a_real_key",
    STRIPE_TEST_CUSTOMER_IDS: "00000000-0000-4000-8000-000000000001",
    STRIPE_WEBHOOK_SECRET: "whsec_not_a_real_secret",
  };
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Stripe checkout configuration", () => {
  it("loads only the controlled test-mode configuration", () => {
    validEnvironment();
    const config = readStripeCheckoutConfig({ requireWebhookSecret: true });

    expect(config.appOrigin).toBe("https://app.genxjumps.com");
    expect(config.priceId).toBe("price_test_accelerator");
    expect(config.allowedCustomerIds.has("00000000-0000-4000-8000-000000000001")).toBe(true);
  });

  it("fails closed when checkout is disabled", () => {
    validEnvironment();
    process.env.STRIPE_CHECKOUT_ENABLED = "false";
    expect(() => readStripeCheckoutConfig()).toThrow("Stripe checkout is disabled");
  });

  it("rejects live Stripe credentials", () => {
    validEnvironment();
    process.env.STRIPE_SECRET_KEY = "sk_live_never_allowed_here";
    expect(() => readStripeCheckoutConfig()).toThrow("test-mode");
  });

  it("requires a signed webhook secret at the webhook boundary", () => {
    validEnvironment();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(() => readStripeCheckoutConfig({ requireWebhookSecret: true })).toThrow(
      "Missing STRIPE_WEBHOOK_SECRET",
    );
  });

  it("reports safe configuration issue codes without returning secret values", () => {
    validEnvironment();
    process.env.STRIPE_SECRET_KEY = "sk_live_secret_value";

    let failure: unknown;
    try {
      readStripeCheckoutConfig();
    } catch (error) {
      failure = error;
    }

    expect(stripeCheckoutConfigIssue(failure)).toBe("invalid_secret_key_mode");
    expect(stripeCheckoutConfigIssue(failure)).not.toContain("secret_value");
  });
});
