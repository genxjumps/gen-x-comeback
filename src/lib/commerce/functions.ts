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

export type GuestCheckoutAvailabilityResult = {
  ok: true;
  enabled: boolean;
  priceCents: number;
  issue: null | import("@/lib/commerce/stripe-config.server").StripeCheckoutConfigIssue;
};

export type CreateCheckoutResult =
  | { ok: false; reason: "already_owned" | "closed" | "unauthorized" | "unavailable" }
  | { ok: true; checkoutUrl: string };

export type ConfirmCheckoutResult =
  | { ok: false; reason: "invalid" | "pending" | "unauthorized" | "unavailable" }
  | { ok: true; authTokenHash: string | null; entitlementId: string };

const GUEST_CHECKOUT_CLAIM_COOKIE = "gxj_accelerator_checkout_claim";
const GUEST_CHECKOUT_CLAIM_MAX_AGE = 24 * 60 * 60;

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

export const createGuestAcceleratorCheckout = createServerFn({ method: "POST" }).handler(
  async (): Promise<CreateCheckoutResult> => {
    try {
      const { getRequest, setCookie } = await import("@tanstack/react-start/server");
      const request = getRequest();
      const { callerBucketKey, consumeRateLimit } = await import("@/lib/email/rate-limit.server");
      const limit = await consumeRateLimit(callerBucketKey("guest_checkout", request), 3600, 20);
      if (!limit.allowed) return { ok: false, reason: "closed" };

      const { createStripeEdgeGuestCheckout } = await import("@/lib/commerce/stripe-edge.server");
      const result = await createStripeEdgeGuestCheckout();
      if (!result.ok) return result;
      setCookie(GUEST_CHECKOUT_CLAIM_COOKIE, result.claimToken, {
        path: "/",
        maxAge: GUEST_CHECKOUT_CLAIM_MAX_AGE,
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      });
      return { ok: true, checkoutUrl: result.checkoutUrl };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  },
);

export const getGuestAcceleratorCheckoutAvailability = createServerFn({ method: "POST" }).handler(
  async (): Promise<GuestCheckoutAvailabilityResult> => {
    const { getStripeEdgeGuestAvailability } = await import("@/lib/commerce/stripe-edge.server");
    return getStripeEdgeGuestAvailability();
  },
);

const confirmCheckoutSchema = z.object({
  sessionId: z.string().regex(/^cs_test_[A-Za-z0-9]+$/),
});

export const confirmAcceleratorCheckout = createServerFn({ method: "POST" })
  .validator((data: unknown) => confirmCheckoutSchema.parse(data))
  .handler(async ({ data }): Promise<ConfirmCheckoutResult> => {
    const resolved = await account();
    const edge = await import("@/lib/commerce/stripe-edge.server");
    if (resolved.ok) {
      const result = await edge.confirmStripeEdgeCheckout({
        customerAccountId: resolved.account.id,
        sessionId: data.sessionId,
      });
      return result.ok ? { ...result, authTokenHash: null } : result;
    }

    try {
      const { deleteCookie, getCookie } = await import("@tanstack/react-start/server");
      const claimToken = getCookie(GUEST_CHECKOUT_CLAIM_COOKIE);
      if (!claimToken) return { ok: false, reason: "unauthorized" };
      const result = await edge.confirmStripeEdgeGuestCheckout({
        claimToken,
        sessionId: data.sessionId,
      });
      if (result.ok) deleteCookie(GUEST_CHECKOUT_CLAIM_COOKIE, { path: "/" });
      return result;
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  });
