import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import {
  createAcceleratorCheckout,
  getAcceleratorCheckoutAvailability,
  type CheckoutAvailabilityResult,
} from "@/lib/commerce/functions";

export const Route = createFileRoute("/programs")({
  head: () => ({
    meta: [
      { title: "Explore Programs | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Programs,
});

function Programs() {
  const loadAvailability = useServerFn(getAcceleratorCheckoutAvailability);
  const openCheckout = useServerFn(createAcceleratorCheckout);
  const [availability, setAvailability] = useState<CheckoutAvailabilityResult | null>(null);
  const [opening, setOpening] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadAvailability()
      .then((result) => active && setAvailability(result))
      .catch(() => active && setAvailability({ ok: false }));
    return () => {
      active = false;
    };
  }, [loadAvailability]);

  async function beginCheckout() {
    if (opening) return;
    setOpening(true);
    setCheckoutError(null);
    try {
      const result = await openCheckout();
      if (result.ok) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      if (result.reason === "already_owned") {
        setAvailability((current) => (current?.ok ? { ...current, owned: true } : current));
        return;
      }
      setCheckoutError("Test checkout is not available for this account.");
    } catch {
      setCheckoutError("Test checkout could not be opened. Try again in a moment.");
    } finally {
      setOpening(false);
    }
  }

  const controlledCheckout =
    availability?.ok && availability.enabled && availability.allowed && !availability.owned;

  return (
    <PlatformPage
      kicker="Explore Programs"
      title="Find Your Next Program"
      description="Gen X Jumps is built around structured programs that tell you what to do next - not an endless video library."
    >
      <section className="rounded-lg border border-border bg-card p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
          {controlledCheckout ? "Controlled test checkout" : "Enrollment closed during development"}
        </p>
        <h2 className="mt-2 text-xl font-semibold">28-Day Fat Loss Accelerator</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {availability?.ok && availability.owned
            ? "You own the Accelerator for life. Starting Day 1 remains your choice."
            : controlledCheckout
              ? "One payment of $37. This test checkout cannot charge a real card. Buying creates ownership but does not start Day 1."
              : "The program can appear here without opening checkout or making any payment-provider call."}
        </p>
        {availability?.ok && availability.owned ? (
          <Button asChild className="mt-5 w-full sm:w-auto">
            <Link to="/my-programs">Open My Programs</Link>
          </Button>
        ) : null}
        {controlledCheckout ? (
          <Button
            type="button"
            className="mt-5 w-full sm:w-auto"
            disabled={opening}
            onClick={() => void beginCheckout()}
          >
            {opening ? "Opening Stripe..." : "Open $37 Test Checkout"}
          </Button>
        ) : null}
        {checkoutError ? <p className="mt-3 text-sm font-medium">{checkoutError}</p> : null}
      </section>
    </PlatformPage>
  );
}
