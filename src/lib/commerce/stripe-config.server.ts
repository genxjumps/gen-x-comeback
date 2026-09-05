import { z } from "zod";

const uuidSchema = z.string().uuid();

export type StripeCheckoutConfig = {
  appOrigin: string;
  allowedCustomerIds: ReadonlySet<string>;
  priceId: string;
  secretKey: string;
  webhookSecret: string | null;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function testSecretKey(value: string): string {
  if (!/^(sk|rk)_test_/.test(value)) {
    throw new Error("Stripe checkout requires a test-mode secret or restricted key");
  }
  return value;
}

function appOrigin(value: string): string {
  const parsed = new URL(value);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("APP_ORIGIN must contain only the app origin");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("APP_ORIGIN must use HTTPS outside localhost");
  }
  return parsed.origin;
}

function allowedCustomerIds(value: string): ReadonlySet<string> {
  const ids = value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => uuidSchema.parse(candidate));
  if (!ids.length) throw new Error("STRIPE_TEST_CUSTOMER_IDS must include a controlled account");
  return new Set(ids);
}

export function readStripeCheckoutConfig(options?: {
  requireWebhookSecret?: boolean;
}): StripeCheckoutConfig {
  if (process.env["STRIPE_CHECKOUT_ENABLED"] !== "true") {
    throw new Error("Stripe checkout is disabled");
  }

  const priceId = requiredEnvironment("STRIPE_ACCELERATOR_PRICE_ID");
  if (!priceId.startsWith("price_")) throw new Error("Invalid STRIPE_ACCELERATOR_PRICE_ID");

  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"]?.trim() || null;
  if (options?.requireWebhookSecret && !webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }
  if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
    throw new Error("Invalid STRIPE_WEBHOOK_SECRET");
  }

  return {
    appOrigin: appOrigin(requiredEnvironment("APP_ORIGIN")),
    allowedCustomerIds: allowedCustomerIds(requiredEnvironment("STRIPE_TEST_CUSTOMER_IDS")),
    priceId,
    secretKey: testSecretKey(requiredEnvironment("STRIPE_SECRET_KEY")),
    webhookSecret,
  };
}
