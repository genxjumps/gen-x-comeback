import { z } from "zod";

import type {
  CheckoutAvailabilityResult,
  ConfirmCheckoutResult,
  CreateCheckoutResult,
} from "@/lib/commerce/functions";

type EdgeRuntimeConfig = {
  endpoint: string | null;
  serviceRoleKey: string | null;
};

const availabilitySchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(false), issue: z.literal("account_unavailable") }),
  z.object({
    ok: z.literal(true),
    enabled: z.boolean(),
    allowed: z.boolean(),
    owned: z.boolean(),
    priceCents: z.number().int().nonnegative(),
    issue: z
      .enum([
        "checkout_disabled",
        "missing_app_origin",
        "missing_price_id",
        "missing_secret_key",
        "missing_test_customer_ids",
        "invalid_app_origin",
        "invalid_price_id",
        "invalid_secret_key_mode",
        "invalid_webhook_secret",
        "invalid_test_customer_ids",
        "customer_not_allowlisted",
        "unknown_configuration_error",
      ])
      .nullable(),
  }),
]);

const createSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(false),
    reason: z.enum(["already_owned", "closed", "unauthorized", "unavailable"]),
  }),
  z.object({
    ok: z.literal(true),
    checkoutUrl: z.string().url().startsWith("https://checkout.stripe.com/"),
  }),
]);

const confirmSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(false),
    reason: z.enum(["invalid", "unauthorized", "unavailable"]),
  }),
  z.object({ ok: z.literal(true), entitlementId: z.string().uuid() }),
]);

function env(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readStripeEdgeRuntimeConfig(): EdgeRuntimeConfig {
  const supabaseUrl = env("SUPABASE_URL");
  return {
    endpoint: supabaseUrl
      ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/accelerator-stripe`
      : null,
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

async function invokeEdge(
  body: unknown,
  fetchImpl: typeof fetch = fetch,
  config: EdgeRuntimeConfig = readStripeEdgeRuntimeConfig(),
): Promise<{ response: Response; payload: unknown }> {
  if (!config.endpoint || !config.serviceRoleKey) throw new Error("stripe_edge_runtime_missing");
  const response = await fetchImpl(config.endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Callers fail closed when the edge response is unavailable or malformed.
  }
  return { response, payload };
}

export async function getStripeEdgeAvailability(input: {
  customerAccountId: string;
}): Promise<CheckoutAvailabilityResult> {
  try {
    const { response, payload } = await invokeEdge({
      action: "availability",
      customerAccountId: input.customerAccountId,
    });
    if (!response.ok) throw new Error("stripe_edge_unavailable");
    return availabilitySchema.parse(payload);
  } catch {
    return {
      ok: true,
      enabled: false,
      allowed: false,
      owned: false,
      priceCents: 3_700,
      issue: "unknown_configuration_error",
    };
  }
}

export async function createStripeEdgeCheckout(input: {
  customerAccountId: string;
  email: string;
}): Promise<CreateCheckoutResult> {
  try {
    const { response, payload } = await invokeEdge({
      action: "create_checkout",
      account: { id: input.customerAccountId, email: input.email },
    });
    if (!response.ok && response.status >= 500) throw new Error("stripe_edge_unavailable");
    return createSchema.parse(payload);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function confirmStripeEdgeCheckout(input: {
  customerAccountId: string;
  sessionId: string;
}): Promise<ConfirmCheckoutResult> {
  try {
    const { response, payload } = await invokeEdge({
      action: "confirm_checkout",
      expectedCustomerAccountId: input.customerAccountId,
      sessionId: input.sessionId,
    });
    if (!response.ok && response.status >= 500) throw new Error("stripe_edge_unavailable");
    return confirmSchema.parse(payload);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function forwardStripeWebhookToEdge(input: {
  rawBody: string;
  signature: string;
}): Promise<Response> {
  try {
    const { response, payload } = await invokeEdge({ action: "webhook", ...input });
    return Response.json(payload ?? { error: "edge_unavailable" }, { status: response.status });
  } catch {
    return new Response("webhook edge unavailable", { status: 503 });
  }
}
