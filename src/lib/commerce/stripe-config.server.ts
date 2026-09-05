import { z } from "zod";

const uuidSchema = z.string().uuid();

export type StripeCheckoutConfig = {
  appOrigin: string;
  allowedCustomerIds: ReadonlySet<string>;
  priceId: string;
  secretKey: string;
  webhookSecret: string | null;
};

export type StripeCheckoutConfigIssue =
  | "checkout_disabled"
  | "missing_app_origin"
  | "missing_price_id"
  | "missing_secret_key"
  | "missing_test_customer_ids"
  | "invalid_app_origin"
  | "invalid_price_id"
  | "invalid_secret_key_mode"
  | "invalid_webhook_secret"
  | "invalid_test_customer_ids"
  | "unknown_configuration_error";

/** Converts configuration failures into safe diagnostic codes without exposing values. */
export function stripeCheckoutConfigIssue(error: unknown): StripeCheckoutConfigIssue {
  const message = error instanceof Error ? error.message : "";
  if (message === "Stripe checkout is disabled") return "checkout_disabled";
  if (message === "Missing APP_ORIGIN") return "missing_app_origin";
  if (message === "Missing STRIPE_ACCELERATOR_PRICE_ID") return "missing_price_id";
  if (message === "Missing STRIPE_SECRET_KEY") return "missing_secret_key";
  if (message === "Missing STRIPE_TEST_CUSTOMER_IDS") return "missing_test_customer_ids";
  if (message === "Invalid STRIPE_ACCELERATOR_PRICE_ID") return "invalid_price_id";
  if (message.includes("test-mode secret")) return "invalid_secret_key_mode";
  if (message === "Invalid STRIPE_WEBHOOK_SECRET") return "invalid_webhook_secret";
  if (message.includes("APP_ORIGIN")) return "invalid_app_origin";
  if (message.includes("STRIPE_TEST_CUSTOMER_IDS") || message.includes("Invalid uuid")) {
    return "invalid_test_customer_ids";
  }
  return "unknown_configuration_error";
}

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
