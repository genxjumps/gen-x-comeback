import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    const { getStripeEdgeAvailability } = await import("@/lib/commerce/stripe-edge.server");
    return getStripeEdgeAvailability({ customerAccountId: resolved.account.id });
  },
);

export const createAcceleratorCheckout = createServerFn({ method: "POST" }).handler(
  async (): Promise<CreateCheckoutResult> => {
    const resolved = await account();
    if (!resolved.ok) return { ok: false, reason: "unauthorized" };

    const { createStripeEdgeCheckout } = await import("@/lib/commerce/stripe-edge.server");
    return createStripeEdgeCheckout({
      customerAccountId: resolved.account.id,
      email: resolved.account.email,
    });
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

    const { confirmStripeEdgeCheckout } = await import("@/lib/commerce/stripe-edge.server");
    return confirmStripeEdgeCheckout({
      customerAccountId: resolved.account.id,
      sessionId: data.sessionId,
    });
  });
