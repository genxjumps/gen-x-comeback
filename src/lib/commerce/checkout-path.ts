import type { CheckoutAvailabilityResult } from "./functions";

/** A known account must never fall through to a different guest identity. */
export function checkoutPath(account: CheckoutAvailabilityResult | null, guestEnabled: boolean) {
  if (!account) return "loading";
  if (account.ok) {
    if (account.owned) return "owned";
    return account.enabled && account.allowed ? "account" : "closed";
  }
  return guestEnabled ? "guest" : "closed";
}
