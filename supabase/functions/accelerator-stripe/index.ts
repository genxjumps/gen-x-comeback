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
  guestEnabled: boolean;
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

type DiagnosticAction =
  | "availability"
  | "guest_availability"
  | "create_checkout"
  | "create_guest_checkout"
  | "confirm_checkout"
  | "confirm_guest_checkout"
  | "webhook";
type FulfillmentStage =
  | "validate_session_id"
  | "retrieve_session"
  | "validate_session"
  | "validate_price"
  | "validate_charge"
  | "validate_guest_claim"
  | "resolve_customer"
  | "provision_ownership";

const SAFE_FAILURE_REASONS = new Set([
  "invalid_session_id",
  "session_customer_missing",
  "session_customer_not_allowed",
  "session_client_reference_mismatch",
  "live_session_rejected",
  "session_customer_mismatch",
  "session_mode_mismatch",
  "session_not_complete",
  "session_not_paid",
  "session_amount_mismatch",
  "session_currency_mismatch",
  "session_product_mismatch",
  "session_version_mismatch",
  "product_not_expanded",
  "line_items_mismatch",
  "price_mismatch",
  "intent_not_expanded",
  "charge_not_paid",
  "guest_checkout_disabled",
  "guest_claim_invalid",
  "guest_email_missing",
  "guest_identity_error",
  "guest_account_error",
  "guest_handoff_pending",
  "provision_rpc_error",
  "provision_rejected",
]);

class FulfillmentFailure extends Error {
  constructor(
    readonly stage: FulfillmentStage,
    readonly reason: string,
  ) {
    super("fulfillment_failed");
    this.name = "FulfillmentFailure";
  }
}

function safeFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : null;
  return message && SAFE_FAILURE_REASONS.has(message) ? message : "provider_or_runtime_error";
}

function safeToken(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,80}$/.test(value) ? value : null;
}

function logFailure(action: DiagnosticAction, stage: string, error: unknown): void {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const statusCode =
    typeof record["statusCode"] === "number" && Number.isInteger(record["statusCode"])
      ? record["statusCode"]
      : null;
  console.error(
    JSON.stringify({
      component: "accelerator-stripe",
      event: "request_failed",
      action,
      stage,
      reason: safeFailureReason(error),
      errorName: safeToken(error instanceof Error ? error.name : null),
      providerType: safeToken(record["type"]),
      providerCode: safeToken(record["code"]),
      statusCode,
    }),
  );
}

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
    guestEnabled: env("STRIPE_GUEST_CHECKOUT_ENABLED")?.toLowerCase() === "true",
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

function providerConfigIssue(config: Config): ConfigIssue | null {
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
  if (!config.supabaseUrl || !config.serviceRoleKey) return "unknown_configuration_error";
  return null;
}

function configIssue(config: Config): ConfigIssue | null {
  const providerIssue = providerConfigIssue(config);
  if (providerIssue) return providerIssue;
  if (config.allowedCustomerIds.size === 0) return "missing_test_customer_ids";
  if ([...config.allowedCustomerIds].some((id) => !validUuid(id)))
    return "invalid_test_customer_ids";
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
    guest_checkout_enabled: config.guestEnabled,
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

async function guestAvailability(config: Config): Promise<Response> {
  const issue = providerConfigIssue(config);
  return json({
    ok: true,
    enabled: !issue && config.guestEnabled,
    priceCents: PRICE_CENTS,
    issue: issue ?? (config.guestEnabled ? null : "checkout_disabled"),
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
        genx_checkout_kind: "account",
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

function randomGuestClaim(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createGuestCheckout(config: Config): Promise<Response> {
  if (providerConfigIssue(config)) return json({ ok: false, reason: "unavailable" }, 503);
  if (!config.guestEnabled) return json({ ok: false, reason: "closed" }, 403);

  const stripe = stripeClient(config);
  const price = await stripe.prices.retrieve(config.priceId!, { expand: ["product"] });
  assertPrice(price, config);
  const claimToken = randomGuestClaim();
  const claimHash = await sha256(claimToken);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: config.priceId!, quantity: 1 }],
    customer_creation: "always",
    metadata: {
      genx_checkout_kind: "guest",
      genx_guest_claim_hash: claimHash,
      genx_product_code: PRODUCT_CODE,
      genx_program_version: PROGRAM_VERSION,
    },
    payment_intent_data: {
      metadata: {
        genx_checkout_kind: "guest",
        genx_product_code: PRODUCT_CODE,
        genx_program_version: PROGRAM_VERSION,
      },
    },
    success_url: `${new URL(config.appOrigin!).origin}/checkout/accelerator/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${new URL(config.appOrigin!).origin}/programs/accelerator?checkout=cancelled`,
    allow_promotion_codes: false,
    billing_address_collection: "auto",
    submit_type: "pay",
  });
  if (!session.url || session.livemode) throw new Error("invalid_checkout_session");
  return json({ ok: true, checkoutUrl: session.url, claimToken });
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

function guestEmail(session: Stripe.Checkout.Session): string {
  const original = (session.customer_details?.email ?? session.customer_email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(original) || original.length > 254)
    throw new Error("guest_email_missing");
  return original;
}

function guestFirstName(session: Stripe.Checkout.Session): string | null {
  const candidate = session.customer_details?.name?.trim().split(/\s+/)[0] ?? "";
  return candidate.length >= 1 && candidate.length <= 60 ? candidate : null;
}

async function resolveGuestCustomer(config: Config, session: Stripe.Checkout.Session) {
  const emailOriginal = guestEmail(session);
  const emailNormalized = emailOriginal.toLowerCase();
  const client = adminClient(config);
  const { data: authLink, error: authError } = await client.auth.admin.generateLink({
    type: "magiclink",
    email: emailOriginal,
  });
  if (authError || !authLink.user?.id || !authLink.properties?.hashed_token)
    throw new Error("guest_identity_error");

  const verifiedAt = new Date(session.created * 1_000).toISOString();
  const { data: rows, error } = await client.rpc("resolve_verified_customer_account", {
    p_auth_user_id: authLink.user.id,
    p_email_normalized: emailNormalized,
    p_email_original: emailOriginal,
    p_email_verified_at: verifiedAt,
    p_first_name: guestFirstName(session),
  });
  const row = rows?.[0];
  if (error || !row || !["created", "replayed"].includes(row.outcome))
    throw new Error("guest_account_error");
  return {
    authTokenHash: authLink.properties.hashed_token,
    customerAccountId: row.customer_id as string,
  };
}

async function readGuestHandoff(config: Config, sessionId: string) {
  const { data, error } = await adminClient(config)
    .from("accelerator_guest_checkout_handoffs")
    .select("customer_id, entitlement_id, auth_token_hash, expires_at")
    .eq("stripe_session_id", sessionId)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (error) throw new Error("guest_account_error");
  return data?.[0] ?? null;
}

async function storeGuestHandoff(
  config: Config,
  input: {
    authTokenHash: string;
    customerAccountId: string;
    entitlementId: string;
    sessionId: string;
  },
) {
  const { error } = await adminClient(config)
    .from("accelerator_guest_checkout_handoffs")
    .insert({
      stripe_session_id: input.sessionId,
      customer_id: input.customerAccountId,
      entitlement_id: input.entitlementId,
      auth_token_hash: input.authTokenHash,
      expires_at: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
    });
  if (error) {
    const existing = await readGuestHandoff(config, input.sessionId);
    if (!existing) throw new Error("guest_account_error");
    return existing;
  }
  return readGuestHandoff(config, input.sessionId);
}

async function fulfill(
  config: Config,
  sessionId: string,
  action: Extract<DiagnosticAction, "confirm_checkout" | "confirm_guest_checkout" | "webhook">,
  expectedCustomerAccountId?: string,
  guestClaimToken?: string,
) {
  let stage: FulfillmentStage = "validate_session_id";
  try {
    if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("invalid_session_id");
    const stripe = stripeClient(config);
    stage = "retrieve_session";
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product", "payment_intent.latest_charge"],
    });
    stage = "validate_session";
    if (session.livemode !== false) throw new Error("live_session_rejected");
    if (session.mode !== "payment") throw new Error("session_mode_mismatch");
    if (session.status !== "complete") throw new Error("session_not_complete");
    if (session.payment_status !== "paid") throw new Error("session_not_paid");
    if (session.amount_total !== PRICE_CENTS) throw new Error("session_amount_mismatch");
    if (session.currency?.toUpperCase() !== CURRENCY) throw new Error("session_currency_mismatch");
    if (session.metadata?.["genx_product_code"] !== PRODUCT_CODE)
      throw new Error("session_product_mismatch");
    if (session.metadata?.["genx_program_version"] !== PROGRAM_VERSION)
      throw new Error("session_version_mismatch");

    const guestCheckout = session.metadata?.["genx_checkout_kind"] === "guest";
    let authTokenHash: string | null = null;
    let existingGuestHandoff: Awaited<ReturnType<typeof readGuestHandoff>> = null;
    let customerAccountId: string;
    if (guestCheckout) {
      if (!config.guestEnabled) throw new Error("guest_checkout_disabled");
      if (action === "confirm_guest_checkout") {
        stage = "validate_guest_claim";
        const storedHash = session.metadata?.["genx_guest_claim_hash"] ?? null;
        const suppliedHash = guestClaimToken ? await sha256(guestClaimToken) : null;
        if (!(await secretsMatch(suppliedHash, storedHash))) throw new Error("guest_claim_invalid");
        existingGuestHandoff = await readGuestHandoff(config, session.id);
        if (!existingGuestHandoff) throw new Error("guest_handoff_pending");
        customerAccountId = existingGuestHandoff.customer_id;
        authTokenHash = existingGuestHandoff.auth_token_hash;
      } else if (action !== "webhook") {
        throw new Error("guest_claim_invalid");
      } else {
        existingGuestHandoff = await readGuestHandoff(config, session.id);
        if (existingGuestHandoff) {
          customerAccountId = existingGuestHandoff.customer_id;
          authTokenHash = existingGuestHandoff.auth_token_hash;
        } else {
          stage = "resolve_customer";
          const guest = await resolveGuestCustomer(config, session);
          customerAccountId = guest.customerAccountId;
          authTokenHash = guest.authTokenHash;
        }
      }
    } else {
      const accountId = session.metadata?.["customer_account_id"];
      if (!accountId) throw new Error("session_customer_missing");
      if (!config.allowedCustomerIds.has(accountId))
        throw new Error("session_customer_not_allowed");
      if (session.client_reference_id !== accountId)
        throw new Error("session_client_reference_mismatch");
      if (expectedCustomerAccountId && expectedCustomerAccountId !== accountId)
        throw new Error("session_customer_mismatch");
      customerAccountId = accountId;
    }

    stage = "validate_price";
    assertPrice(checkoutPrice(session), config);
    stage = "validate_charge";
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
    stage = "provision_ownership";
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
    if (error) throw new Error("provision_rpc_error");
    const row = rows?.[0];
    if (!row || !["created", "replayed"].includes(row.outcome))
      throw new Error("provision_rejected");
    if (guestCheckout && action === "webhook" && !existingGuestHandoff) {
      if (!authTokenHash) throw new Error("guest_identity_error");
      const handoff = await storeGuestHandoff(config, {
        authTokenHash,
        customerAccountId,
        entitlementId: row.entitlement_id as string,
        sessionId: session.id,
      });
      if (!handoff) throw new Error("guest_account_error");
      authTokenHash = handoff.auth_token_hash;
    }
    return {
      authTokenHash,
      entitlementId: row.entitlement_id as string,
      replayed: row.replayed as boolean,
    };
  } catch (error) {
    const reason = safeFailureReason(error);
    if (reason !== "guest_handoff_pending") logFailure(action, stage, error);
    throw new FulfillmentFailure(stage, reason);
  }
}

async function confirmGuestCheckout(
  config: Config,
  body: Record<string, unknown>,
): Promise<Response> {
  if (providerConfigIssue(config)) return json({ ok: false, reason: "unavailable" }, 503);
  const sessionId = body.sessionId;
  const claimToken = body.claimToken;
  if (
    typeof sessionId !== "string" ||
    typeof claimToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(claimToken)
  )
    return json({ ok: false, reason: "invalid" }, 400);
  try {
    const result = await fulfill(
      config,
      sessionId,
      "confirm_guest_checkout",
      undefined,
      claimToken,
    );
    if (!result.authTokenHash) return json({ ok: false, reason: "invalid" }, 400);
    return json({
      ok: true,
      authTokenHash: result.authTokenHash,
      entitlementId: result.entitlementId,
    });
  } catch (error) {
    if (error instanceof FulfillmentFailure && error.reason === "guest_handoff_pending")
      return json({ ok: false, reason: "pending" }, 409);
    return json({ ok: false, reason: "invalid" }, 400);
  }
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
    const result = await fulfill(config, sessionId, "confirm_checkout", expectedCustomerAccountId);
    return json({ ok: true, entitlementId: result.entitlementId });
  } catch {
    return json({ ok: false, reason: "invalid" }, 400);
  }
}

async function webhook(config: Config, body: Record<string, unknown>): Promise<Response> {
  if (providerConfigIssue(config)) return json({ error: "unavailable" }, 503);
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
      const result = await fulfill(config, event.data.object.id, "webhook");
      return json({ received: true, handled: true, replayed: result.replayed });
    } catch (error) {
      const failure =
        error instanceof FulfillmentFailure
          ? error
          : new FulfillmentFailure("provision_ownership", "provider_or_runtime_error");
      return json(
        { error: "fulfillment_failed", stage: failure.stage, reason: failure.reason },
        500,
      );
    }
  } catch (error) {
    logFailure("webhook", "verify_webhook_signature", error);
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
    if (record.action === "guest_availability") return await guestAvailability(config);
    if (record.action === "create_checkout") return await createCheckout(config, record);
    if (record.action === "create_guest_checkout") return await createGuestCheckout(config);
    if (record.action === "confirm_checkout") return await confirmCheckout(config, record);
    if (record.action === "confirm_guest_checkout")
      return await confirmGuestCheckout(config, record);
    if (record.action === "webhook") return await webhook(config, record);
    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    const action = record.action;
    if (
      [
        "availability",
        "guest_availability",
        "create_checkout",
        "create_guest_checkout",
        "confirm_checkout",
        "confirm_guest_checkout",
        "webhook",
      ].includes(String(action))
    )
      logFailure(action as DiagnosticAction, "dispatch", error);
    return json({ error: "edge_failure" }, 500);
  }
});
