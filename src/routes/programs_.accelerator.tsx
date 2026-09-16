import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AcceleratorOfferPage } from "@/components/accelerator-offer-page";
import { checkoutPath } from "@/lib/commerce/checkout-path";
import {
  createGuestAcceleratorCheckout,
  createAcceleratorCheckout,
  getAcceleratorCheckoutAvailability,
  getGuestAcceleratorCheckoutAvailability,
  type CheckoutAvailabilityResult,
} from "@/lib/commerce/functions";

export const Route = createFileRoute("/programs_/accelerator")({
  validateSearch: z.object({ checkout: z.literal("cancelled").optional() }),
  head: () => ({
    meta: [
      { title: "28-Day Fat Loss Accelerator | Gen X Jumps" },
      {
        name: "description",
        content:
          "A structured 28-day program with workouts, progress support, and practical nutrition targets for Gen X adults.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AcceleratorProgramDetail,
});

function AcceleratorProgramDetail() {
  const { checkout } = Route.useSearch();
  const loadAvailability = useServerFn(getGuestAcceleratorCheckoutAvailability);
  const loadAccountAvailability = useServerFn(getAcceleratorCheckoutAvailability);
  const openCheckout = useServerFn(createGuestAcceleratorCheckout);
  const openAccountCheckout = useServerFn(createAcceleratorCheckout);
  const [available, setAvailable] = useState(false);
  const [accountAvailability, setAccountAvailability] = useState<CheckoutAvailabilityResult | null>(
    null,
  );
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([loadAvailability(), loadAccountAvailability()])
      .then(([guest, account]) => {
        if (!active) return;
        setAvailable(guest.enabled);
        setAccountAvailability(account);
      })
      .catch(() => active && setAvailable(false));
    return () => {
      active = false;
    };
  }, [loadAccountAvailability, loadAvailability]);

  async function beginCheckout() {
    if (opening || (path !== "account" && path !== "guest")) return;
    setOpening(true);
    setError(null);
    try {
      const result = path === "account" ? await openAccountCheckout() : await openCheckout();
      if (result.ok) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setError("Test checkout isn’t available right now.");
    } catch {
      setError("Test checkout couldn’t be opened. Try again in a moment.");
    } finally {
      setOpening(false);
    }
  }

  const path = checkoutPath(accountAvailability, available);
  const owned = path === "owned";
  const checkoutAvailable = path === "account" || path === "guest";

  return (
    <AcceleratorOfferPage
      actionLabel={
        owned ? "Open My Programs" : opening ? "Opening Stripe..." : "Get the Accelerator"
      }
      actionDisabled={!owned && (!checkoutAvailable || opening)}
      onAction={owned ? () => window.location.assign("/my-programs") : () => void beginCheckout()}
      status={
        <>
          {!owned ? (
            <p>This checkout uses Stripe test mode and cannot charge a real card.</p>
          ) : null}
          {!checkoutAvailable && !owned ? (
            <p role="status" className="mt-2 font-medium">
              {path === "loading"
                ? "Checking your access..."
                : "Checkout isn't open for this account right now."}
            </p>
          ) : null}
          {checkout === "cancelled" ? (
            <p className="mt-2 font-medium">Checkout was canceled. Nothing was charged.</p>
          ) : null}
          {error ? <p className="mt-2 font-medium">{error}</p> : null}
        </>
      }
    />
  );
}
