import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ACCELERATOR_OFFER } from "@/lib/accelerator/program";

export type CheckoutAvailabilityResult =
  | { ok: false; issue: "account_unavailable" }
  | {
      ok: true;
      allowed: boolean;
      enabled: boolean;
      owned: boolean;
      priceCents: number;
      issue:
        | null
        | "customer_not_allowlisted"
        | import("@/lib/commerce/stripe-config.server").StripeCheckoutConfigIssue;
    };

export type CreateCheckoutResult =
  | { ok: false; reason: "already_owned" | "closed" | "unauthorized" | "unavailable" }
  | { ok: true; checkoutUrl: string };

export type ConfirmCheckoutResult =
  | { ok: false; reason: "invalid" | "unauthorized" | "unavailable" }
  | { ok: true; entitlementId: string };

async function account() {
  const { currentAuthorizationHeader, resolveCustomerAccount } =
    await import("@/lib/account/customer-account.server");
  return resolveCustomerAccount(await currentAuthorizationHeader());
}

export const getAcceleratorCheckoutAvailability = createServerFn({ method: "POST" }).handler(
  async (): Promise<CheckoutAvailabilityResult> => {
    const resolved = await account();
    if (!resolved.ok) return { ok: false, issue: "account_unavailable" };

    try {
      const { readStripeCheckoutConfig } = await import("@/lib/commerce/stripe-config.server");
      const { customerIsAllowed, customerOwnsAccelerator } =
        await import("@/lib/commerce/stripe-checkout.server");
      const config = readStripeCheckoutConfig();
      return {
        ok: true,
        enabled: true,
        allowed: customerIsAllowed(config, resolved.account.id),
        owned: await customerOwnsAccelerator(resolved.account.id),
        priceCents: ACCELERATOR_OFFER.priceCents,
        issue: customerIsAllowed(config, resolved.account.id) ? null : "customer_not_allowlisted",
      };
    } catch (error) {
      const { stripeCheckoutConfigIssue } = await import("@/lib/commerce/stripe-config.server");
      return {
        ok: true,
        enabled: false,
        allowed: false,
        owned: false,
        priceCents: ACCELERATOR_OFFER.priceCents,
        issue: stripeCheckoutConfigIssue(error),
      };
    }
  },
);

export const createAcceleratorCheckout = createServerFn({ method: "POST" }).handler(
  async (): Promise<CreateCheckoutResult> => {
    const resolved = await account();
    if (!resolved.ok) return { ok: false, reason: "unauthorized" };

    try {
      const { readStripeCheckoutConfig } = await import("@/lib/commerce/stripe-config.server");
      const { createAcceleratorCheckoutSession, customerIsAllowed, customerOwnsAccelerator } =
        await import("@/lib/commerce/stripe-checkout.server");
      const config = readStripeCheckoutConfig();
      if (!customerIsAllowed(config, resolved.account.id)) return { ok: false, reason: "closed" };
      if (await customerOwnsAccelerator(resolved.account.id)) {
        return { ok: false, reason: "already_owned" };
      }
      const session = await createAcceleratorCheckoutSession({
        account: { id: resolved.account.id, email: resolved.account.email },
        config,
      });
      return { ok: true, checkoutUrl: session.url };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  },
);

const confirmCheckoutSchema = z.object({
  sessionId: z.string().regex(/^cs_test_[A-Za-z0-9]+$/),
});

export const confirmAcceleratorCheckout = createServerFn({ method: "POST" })
  .validator((data: unknown) => confirmCheckoutSchema.parse(data))
  .handler(async ({ data }): Promise<ConfirmCheckoutResult> => {
    const resolved = await account();
    if (!resolved.ok) return { ok: false, reason: "unauthorized" };

    try {
      const { readStripeCheckoutConfig } = await import("@/lib/commerce/stripe-config.server");
      const { fulfillAcceleratorCheckout } = await import("@/lib/commerce/stripe-checkout.server");
      const result = await fulfillAcceleratorCheckout({
        config: readStripeCheckoutConfig(),
        expectedCustomerAccountId: resolved.account.id,
        sessionId: data.sessionId,
      });
      return { ok: true, entitlementId: result.entitlementId };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  });
