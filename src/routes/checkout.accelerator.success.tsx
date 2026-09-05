import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { z } from "zod";

import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import { confirmAcceleratorCheckout } from "@/lib/commerce/functions";

export const Route = createFileRoute("/checkout/accelerator/success")({
  validateSearch: z.object({ session_id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Purchase Complete | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AcceleratorCheckoutSuccess,
});

function AcceleratorCheckoutSuccess() {
  const { session_id: sessionId } = Route.useSearch();
  const confirmCheckout = useServerFn(confirmAcceleratorCheckout);
  const [status, setStatus] = useState<"checking" | "complete" | "error">("checking");

  useEffect(() => {
    let active = true;
    if (!sessionId) {
      setStatus("error");
      return () => {
        active = false;
      };
    }
    void confirmCheckout({ data: { sessionId } })
      .then((result) => active && setStatus(result.ok ? "complete" : "error"))
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [confirmCheckout, sessionId]);

  return (
    <PlatformPage
      kicker="28-Day Fat Loss Accelerator"
      title={status === "complete" ? "You Own It" : "Confirming Your Purchase"}
      description={
        status === "complete"
          ? "Your Accelerator is now in My Programs. Day 1 has not started."
          : status === "error"
            ? "We could not confirm this test purchase. No program was started."
            : "Stripe confirmed the payment. We’re adding the Accelerator to your account now."
      }
    >
      <section className="rounded-lg border border-border bg-card p-6">
        {status === "checking" ? (
          <p className="text-sm text-muted-foreground">Checking the verified Stripe payment...</p>
        ) : status === "complete" ? (
          <div>
            <div className="grid size-11 place-items-center rounded-full bg-muted">
              <Check className="size-5" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Start when you are ready. Your access does not expire.
            </p>
            <Button asChild className="mt-5 w-full sm:w-auto">
              <Link to="/my-programs">Open My Programs</Link>
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Return to Programs and try again. If Stripe charged a test card, the signed webhook
              can still finish the unlock.
            </p>
            <Button asChild variant="outline" className="mt-5 w-full sm:w-auto">
              <Link to="/programs">Return to Programs</Link>
            </Button>
          </div>
        )}
      </section>
    </PlatformPage>
  );
}
