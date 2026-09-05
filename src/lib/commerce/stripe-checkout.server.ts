import Stripe from "stripe";

import {
  ACCELERATOR_OFFER,
  ACCELERATOR_PRODUCT_CODE,
  ACCELERATOR_PROGRAM_VERSION,
} from "@/lib/accelerator/program";
import { provisionAcceleratorOwnership } from "@/lib/accelerator/provision.server";
import type { StripeCheckoutConfig } from "@/lib/commerce/stripe-config.server";

const PURCHASE_SOURCE = "stripe_checkout";

export type AcceleratorCheckoutAccount = {
  id: string;
  email: string;
};

export type AcceleratorCheckoutState = {
  allowed: boolean;
  enabled: boolean;
  owned: boolean;
};

export type FulfilledAcceleratorCheckout = {
  customerAccountId: string;
  entitlementId: string;
  purchaseId: string;
  replayed: boolean;
  sessionId: string;
};

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 10_000 });
}

export function customerIsAllowed(
  config: StripeCheckoutConfig,
  customerAccountId: string,
): boolean {
  return config.allowedCustomerIds.has(customerAccountId);
}

export async function customerOwnsAccelerator(customerAccountId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("paid_product_entitlements")
    .select("id")
    .eq("customer_id", customerAccountId)
    .eq("product_code", ACCELERATOR_PRODUCT_CODE)
    .eq("status", "active")
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.[0]);
}

function productMetadata(product: Stripe.Product | Stripe.DeletedProduct): Record<string, string> {
  return product.deleted ? {} : product.metadata;
}

function assertAcceleratorPrice(price: Stripe.Price, config: StripeCheckoutConfig): void {
  const product = price.product;
  if (typeof product === "string" || !product) throw new Error("Stripe product was not expanded");
  const metadata = productMetadata(product);
  if (
    price.id !== config.priceId ||
    price.livemode !== false ||
    !price.active ||
    price.type !== "one_time" ||
    price.unit_amount !== ACCELERATOR_OFFER.priceCents ||
    price.currency.toUpperCase() !== ACCELERATOR_OFFER.currency ||
    metadata["genx_product_code"] !== ACCELERATOR_PRODUCT_CODE ||
    metadata["genx_program_version"] !== ACCELERATOR_PROGRAM_VERSION
  ) {
    throw new Error("Stripe price does not match the locked Accelerator offer");
  }
}

async function retrieveAndValidatePrice(stripe: Stripe, config: StripeCheckoutConfig) {
  const price = await stripe.prices.retrieve(config.priceId, { expand: ["product"] });
  assertAcceleratorPrice(price, config);
  return price;
}

export async function createAcceleratorCheckoutSession(input: {
  account: AcceleratorCheckoutAccount;
  config: StripeCheckoutConfig;
  stripe?: Stripe;
}): Promise<{ id: string; url: string }> {
  if (!customerIsAllowed(input.config, input.account.id)) {
    throw new Error("Customer is not admitted to test checkout");
  }
  if (await customerOwnsAccelerator(input.account.id)) {
    throw new Error("Customer already owns the Accelerator");
  }

  const stripe = input.stripe ?? createStripeClient(input.config.secretKey);
  await retrieveAndValidatePrice(stripe, input.config);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: input.config.priceId, quantity: 1 }],
      customer_email: input.account.email,
      client_reference_id: input.account.id,
      metadata: {
        customer_account_id: input.account.id,
        genx_product_code: ACCELERATOR_PRODUCT_CODE,
        genx_program_version: ACCELERATOR_PROGRAM_VERSION,
      },
      payment_intent_data: {
        metadata: {
          customer_account_id: input.account.id,
          genx_product_code: ACCELERATOR_PRODUCT_CODE,
          genx_program_version: ACCELERATOR_PROGRAM_VERSION,
        },
      },
      success_url: `${input.config.appOrigin}/checkout/accelerator/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.config.appOrigin}/programs?checkout=cancelled`,
      allow_promotion_codes: false,
      billing_address_collection: "auto",
      submit_type: "pay",
    },
    {
      idempotencyKey: `accelerator-checkout-${input.account.id}-${Math.floor(Date.now() / 600_000)}`,
    },
  );
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return { id: session.id, url: session.url };
}

function checkoutPurchaseTime(session: Stripe.Checkout.Session): string {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent || typeof paymentIntent === "string") {
    throw new Error("Stripe payment intent was not expanded");
  }
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge || typeof latestCharge === "string") {
    throw new Error("Stripe charge was not expanded");
  }
  if (!latestCharge.paid) throw new Error("Stripe charge is not paid");
  return new Date(latestCharge.created * 1_000).toISOString();
}

function checkoutPrice(session: Stripe.Checkout.Session): Stripe.Price {
  const lineItems = session.line_items?.data ?? [];
  if (lineItems.length !== 1 || lineItems[0]?.quantity !== 1 || !lineItems[0].price) {
    throw new Error("Stripe Checkout line items do not match the locked offer");
  }
  return lineItems[0].price;
}

export async function fulfillAcceleratorCheckout(input: {
  config: StripeCheckoutConfig;
  expectedCustomerAccountId?: string;
  sessionId: string;
  stripe?: Stripe;
}): Promise<FulfilledAcceleratorCheckout> {
  const stripe = input.stripe ?? createStripeClient(input.config.secretKey);
  const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ["line_items.data.price.product", "payment_intent.latest_charge"],
  });
  const customerAccountId = session.metadata?.["customer_account_id"];
  if (
    !customerAccountId ||
    !customerIsAllowed(input.config, customerAccountId) ||
    session.client_reference_id !== customerAccountId ||
    session.livemode !== false ||
    (input.expectedCustomerAccountId && input.expectedCustomerAccountId !== customerAccountId) ||
    session.mode !== "payment" ||
    session.status !== "complete" ||
    session.payment_status !== "paid" ||
    session.amount_total !== ACCELERATOR_OFFER.priceCents ||
    session.currency?.toUpperCase() !== ACCELERATOR_OFFER.currency ||
    session.metadata?.["genx_product_code"] !== ACCELERATOR_PRODUCT_CODE ||
    session.metadata?.["genx_program_version"] !== ACCELERATOR_PROGRAM_VERSION
  ) {
    throw new Error("Stripe Checkout session does not match the approved purchase");
  }

  assertAcceleratorPrice(checkoutPrice(session), input.config);
  const provisioned = await provisionAcceleratorOwnership({
    customerAccountId,
    idempotencyKey: session.id,
    purchaseSource: PURCHASE_SOURCE,
    sourceReference: session.id,
    purchasedAt: checkoutPurchaseTime(session),
  });
  return {
    customerAccountId,
    sessionId: session.id,
    ...provisioned,
  };
}

export async function constructStripeWebhookEvent(input: {
  config: StripeCheckoutConfig;
  rawBody: string;
  signature: string;
  stripe?: Stripe;
}): Promise<Stripe.Event> {
  if (!input.config.webhookSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  const stripe = input.stripe ?? createStripeClient(input.config.secretKey);
  return stripe.webhooks.constructEventAsync(
    input.rawBody,
    input.signature,
    input.config.webhookSecret,
  );
}
