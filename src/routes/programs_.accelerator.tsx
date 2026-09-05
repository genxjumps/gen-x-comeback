import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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

const INCLUDED = [
  "A complete 28-day workout schedule",
  "Five guided workouts plus active recovery",
  "Weekly coaching and progress support",
  "Personal calorie, protein, carbohydrate, and fat targets",
  "Permanent access and repeat program runs",
];

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
    if (opening) return;
    setOpening(true);
    setError(null);
    try {
      const accountCheckout =
        accountAvailability?.ok &&
        accountAvailability.enabled &&
        accountAvailability.allowed &&
        !accountAvailability.owned;
      const result = accountCheckout ? await openAccountCheckout() : await openCheckout();
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

  const owned = accountAvailability?.ok && accountAvailability.owned;
  const accountCheckout =
    accountAvailability?.ok &&
    accountAvailability.enabled &&
    accountAvailability.allowed &&
    !accountAvailability.owned;
  const checkoutAvailable = available || accountCheckout;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div>
          <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
            28-Day Fat Loss Accelerator
          </p>
          <h1 className="gxj-display-title mt-3 max-w-3xl text-4xl leading-tight tracking-tight sm:text-5xl">
            Know Exactly What To Do For The Next 28 Days
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A structured next step for Gen X adults who want consistent workouts, simple nutrition
            targets, and a clear path forward without an endless video library.
          </p>

          <section className="mt-8 rounded-lg border border-border bg-card p-5 sm:p-6">
            <h2 className="text-xl font-semibold">What’s included</h2>
            <ul className="mt-4 grid gap-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed">
                  <Check className="mt-0.5 size-4 shrink-0 text-gxj-teal" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
            Controlled test checkout
          </p>
          <p className="mt-3 text-3xl font-semibold">$37</p>
          <p className="mt-1 text-sm text-muted-foreground">One payment. Access does not expire.</p>
          {owned ? (
            <Button asChild className="mt-5 w-full">
              <Link to="/my-programs">Open My Programs</Link>
            </Button>
          ) : (
            <Button
              type="button"
              className="mt-5 w-full"
              disabled={!checkoutAvailable || opening}
              onClick={() => void beginCheckout()}
            >
              {opening ? "Opening Stripe..." : "Get the 28-Day Accelerator"}
            </Button>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            This checkout uses Stripe test mode and cannot charge a real card. Buying creates your
            access but does not start Day 1.
          </p>
          {checkout === "cancelled" ? (
            <p className="mt-3 text-sm font-medium">Checkout was canceled. Nothing was charged.</p>
          ) : null}
          {error ? <p className="mt-3 text-sm font-medium">{error}</p> : null}
        </aside>
      </div>
    </div>
  );
}
