import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import Stripe from "npm:stripe@22.6.1";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const PRODUCT_CODE = "accelerator_28";
const PROGRAM_VERSION = "accelerator_28_v1";
const PRICE_CENTS = 3_700;
const CURRENCY = "USD";
const PURCHASE_SOURCE = "stripe_checkout";

type Config = {
  appOrigin: string | null;
  allowedCustomerIds: ReadonlySet<string>;
  enabled: boolean;
  priceId: string | null;
  secretKey: string | null;
  serviceRoleKey: string | null;
  supabaseUrl: string | null;
  webhookSecret: string | null;
};

type ConfigIssue =
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

function env(name: string): string | null {
  const value = Deno.env.get(name);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readConfig(): Config {
  return {
    appOrigin: env("APP_ORIGIN"),
    allowedCustomerIds: new Set(
      (env("STRIPE_TEST_CUSTOMER_IDS") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
    enabled: env("STRIPE_CHECKOUT_ENABLED")?.toLowerCase() === "true",
    priceId: env("STRIPE_ACCELERATOR_PRICE_ID"),
    secretKey: env("STRIPE_SECRET_KEY"),
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseUrl: env("SUPABASE_URL"),
    webhookSecret: env("STRIPE_WEBHOOK_SECRET"),
  };
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function configIssue(config: Config): ConfigIssue | null {
  if (!config.enabled) return "checkout_disabled";
  if (!config.appOrigin) return "missing_app_origin";
  try {
    const origin = new URL(config.appOrigin);
    if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash)
      return "invalid_app_origin";
  } catch {
    return "invalid_app_origin";
  }
  if (!config.priceId) return "missing_price_id";
  if (!config.priceId.startsWith("price_")) return "invalid_price_id";
  if (!config.secretKey) return "missing_secret_key";
  if (!/^(sk|rk)_test_/.test(config.secretKey)) return "invalid_secret_key_mode";
  if (!config.webhookSecret || !config.webhookSecret.startsWith("whsec_"))
    return "invalid_webhook_secret";
  if (config.allowedCustomerIds.size === 0) return "missing_test_customer_ids";
  if ([...config.allowedCustomerIds].some((id) => !validUuid(id)))
    return "invalid_test_customer_ids";
  if (!config.supabaseUrl || !config.serviceRoleKey) return "unknown_configuration_error";
  return null;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function bearer(request: Request): string | null {
  const match = /^Bearer[ ]+(.+)$/.exec(request.headers.get("authorization")?.trim() ?? "");
  return match?.[1]?.trim() || null;
}

async function digestBytes(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secretsMatch(provided: string | null, expected: string | null): Promise<boolean> {
  if (!provided || !expected) return false;
  const [a, b] = await Promise.all([digestBytes(provided), digestBytes(expected)]);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    )
      headers.delete("Authorization");
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function adminClient(config: Config) {
  return createClient(config.supabaseUrl!, config.serviceRoleKey!, {
    global: { fetch: createSupabaseFetch(config.serviceRoleKey!) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function stripeClient(config: Config): Stripe {
  return new Stripe(config.secretKey!, { maxNetworkRetries: 2, timeout: 10_000 });
}

function productMetadata(product: Stripe.Product | Stripe.DeletedProduct): Record<string, string> {
  return product.deleted ? {} : product.metadata;
}

function assertPrice(price: Stripe.Price, config: Config): void {
  const product = price.product;
  if (typeof product === "string" || !product) throw new Error("product_not_expanded");
  const metadata = productMetadata(product);
  if (
    price.id !== config.priceId ||
    price.livemode !== false ||
    !price.active ||
    price.type !== "one_time" ||
    price.unit_amount !== PRICE_CENTS ||
    price.currency.toUpperCase() !== CURRENCY ||
    metadata["genx_product_code"] !== PRODUCT_CODE ||
    metadata["genx_program_version"] !== PROGRAM_VERSION
  )
    throw new Error("price_mismatch");
}

async function customerOwnsAccelerator(config: Config, customerAccountId: string) {
  const { data, error } = await adminClient(config)
    .from("paid_product_entitlements")
    .select("id")
    .eq("customer_id", customerAccountId)
    .eq("product_code", PRODUCT_CODE)
    .eq("status", "active")
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.[0]);
}

function configuration(config: Config): Record<string, boolean> {
  return {
    enable_flag_present: env("STRIPE_CHECKOUT_ENABLED") !== null,
    app_origin_present: config.appOrigin !== null,
    price_id_present: config.priceId !== null,
    secret_key_present: config.secretKey !== null,
    webhook_secret_present: config.webhookSecret !== null,
    test_customer_ids_present: config.allowedCustomerIds.size > 0,
  };
}

async function availability(config: Config, body: Record<string, unknown>): Promise<Response> {
  const issue = configIssue(config);
  if (issue)
    return json({
      ok: true,
      enabled: false,
      allowed: false,
      owned: false,
      priceCents: PRICE_CENTS,
      issue,
      configuration: configuration(config),
    });
  const customerAccountId = body.customerAccountId;
  if (typeof customerAccountId !== "string" || !validUuid(customerAccountId))
    return json({ ok: false, issue: "account_unavailable" }, 400);
  const allowed = config.allowedCustomerIds.has(customerAccountId);
  return json({
    ok: true,
    enabled: true,
    allowed,
    owned: await customerOwnsAccelerator(config, customerAccountId),
    priceCents: PRICE_CENTS,
    issue: allowed ? null : "customer_not_allowlisted",
  });
}

async function createCheckout(config: Config, body: Record<string, unknown>): Promise<Response> {
  if (configIssue(config)) return json({ ok: false, reason: "unavailable" }, 503);
  const account = body.account;
  if (!account || typeof account !== "object" || Array.isArray(account))
    return json({ ok: false, reason: "unauthorized" }, 400);
  const { id, email } = account as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    !validUuid(id) ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return json({ ok: false, reason: "unauthorized" }, 400);
  if (!config.allowedCustomerIds.has(id)) return json({ ok: false, reason: "closed" }, 403);
  if (await customerOwnsAccelerator(config, id))
    return json({ ok: false, reason: "already_owned" }, 409);

  const stripe = stripeClient(config);
  const price = await stripe.prices.retrieve(config.priceId!, { expand: ["product"] });
  assertPrice(price, config);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: config.priceId!, quantity: 1 }],
      customer_email: email.toLowerCase(),
      client_reference_id: id,
      metadata: {
        customer_account_id: id,
        genx_product_code: PRODUCT_CODE,
        genx_program_version: PROGRAM_VERSION,
      },
      payment_intent_data: {
        metadata: {
          customer_account_id: id,
          genx_product_code: PRODUCT_CODE,
          genx_program_version: PROGRAM_VERSION,
        },
      },
      success_url: `${new URL(config.appOrigin!).origin}/checkout/accelerator/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${new URL(config.appOrigin!).origin}/programs?checkout=cancelled`,
      allow_promotion_codes: false,
      billing_address_collection: "auto",
      submit_type: "pay",
    },
    { idempotencyKey: `accelerator-checkout-${id}-${Math.floor(Date.now() / 600_000)}` },
  );
  if (!session.url || session.livemode) throw new Error("invalid_checkout_session");
  return json({ ok: true, checkoutUrl: session.url });
}

function checkoutPurchaseTime(session: Stripe.Checkout.Session): string {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent || typeof paymentIntent === "string") throw new Error("intent_not_expanded");
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge || typeof latestCharge === "string" || !latestCharge.paid)
    throw new Error("charge_not_paid");
  return new Date(latestCharge.created * 1_000).toISOString();
}

function checkoutPrice(session: Stripe.Checkout.Session): Stripe.Price {
  const lineItems = session.line_items?.data ?? [];
  if (lineItems.length !== 1 || lineItems[0]?.quantity !== 1 || !lineItems[0].price)
    throw new Error("line_items_mismatch");
  return lineItems[0].price;
}

async function sha256(value: string): Promise<string> {
  const bytes = await digestBytes(value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fulfill(config: Config, sessionId: string, expectedCustomerAccountId?: string) {
  if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("invalid_session_id");
  const stripe = stripeClient(config);
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product", "payment_intent.latest_charge"],
  });
  const customerAccountId = session.metadata?.["customer_account_id"];
  if (
    !customerAccountId ||
    !config.allowedCustomerIds.has(customerAccountId) ||
    session.client_reference_id !== customerAccountId ||
    session.livemode !== false ||
    (expectedCustomerAccountId && expectedCustomerAccountId !== customerAccountId) ||
    session.mode !== "payment" ||
    session.status !== "complete" ||
    session.payment_status !== "paid" ||
    session.amount_total !== PRICE_CENTS ||
    session.currency?.toUpperCase() !== CURRENCY ||
    session.metadata?.["genx_product_code"] !== PRODUCT_CODE ||
    session.metadata?.["genx_program_version"] !== PROGRAM_VERSION
  )
    throw new Error("session_mismatch");

  assertPrice(checkoutPrice(session), config);
  const purchasedAt = checkoutPurchaseTime(session);
  const requestFingerprint = await sha256(
    [
      session.id,
      customerAccountId,
      PURCHASE_SOURCE,
      session.id,
      purchasedAt,
      PRODUCT_CODE,
      String(PRICE_CENTS),
      CURRENCY,
    ].join("\u0000"),
  );
  const { data: rows, error } = await adminClient(config).rpc("provision_accelerator_ownership", {
    p_customer_id: customerAccountId,
    p_idempotency_key: session.id,
    p_request_fingerprint: requestFingerprint,
    p_purchase_source: PURCHASE_SOURCE,
    p_source_reference: session.id,
    p_purchased_at: purchasedAt,
    p_product_code: PRODUCT_CODE,
    p_amount_cents: PRICE_CENTS,
    p_currency: CURRENCY,
  });
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row || !["created", "replayed"].includes(row.outcome)) throw new Error("provision_rejected");
  return { entitlementId: row.entitlement_id as string, replayed: row.replayed as boolean };
}

async function confirmCheckout(config: Config, body: Record<string, unknown>): Promise<Response> {
  if (configIssue(config)) return json({ ok: false, reason: "unavailable" }, 503);
  const sessionId = body.sessionId;
  const expectedCustomerAccountId = body.expectedCustomerAccountId;
  if (
    typeof sessionId !== "string" ||
    typeof expectedCustomerAccountId !== "string" ||
    !validUuid(expectedCustomerAccountId)
  )
    return json({ ok: false, reason: "invalid" }, 400);
  try {
    const result = await fulfill(config, sessionId, expectedCustomerAccountId);
    return json({ ok: true, entitlementId: result.entitlementId });
  } catch {
    return json({ ok: false, reason: "invalid" }, 400);
  }
}

async function webhook(config: Config, body: Record<string, unknown>): Promise<Response> {
  if (configIssue(config)) return json({ error: "unavailable" }, 503);
  const rawBody = body.rawBody;
  const signature = body.signature;
  if (typeof rawBody !== "string" || typeof signature !== "string")
    return json({ error: "invalid_signature" }, 400);
  try {
    const event = await stripeClient(config).webhooks.constructEventAsync(
      rawBody,
      signature,
      config.webhookSecret!,
    );
    if (event.type !== "checkout.session.completed")
      return json({ received: true, handled: false });
    try {
      const result = await fulfill(config, event.data.object.id);
      return json({ received: true, handled: true, replayed: result.replayed });
    } catch {
      return json({ error: "fulfillment_failed" }, 500);
    }
  } catch {
    return json({ error: "invalid_event" }, 400);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const config = readConfig();
  if (!(await secretsMatch(bearer(request), config.serviceRoleKey)))
    return json({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return json({ error: "invalid_request" }, 400);
  const record = body as Record<string, unknown>;
  try {
    if (record.action === "availability") return await availability(config, record);
    if (record.action === "create_checkout") return await createCheckout(config, record);
    if (record.action === "confirm_checkout") return await confirmCheckout(config, record);
    if (record.action === "webhook") return await webhook(config, record);
    return json({ error: "invalid_action" }, 400);
  } catch {
    return json({ error: "edge_failure" }, 500);
  }
});
