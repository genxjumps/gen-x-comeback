import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { z } from "zod";

import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
  const [entitlementId, setEntitlementId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!sessionId) {
      setStatus("error");
      return () => {
        active = false;
      };
    }
    async function confirmPurchase() {
      let result: Awaited<ReturnType<typeof confirmCheckout>> | null = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        result = await confirmCheckout({ data: { sessionId: sessionId! } });
        if (result.ok || result.reason !== "pending") break;
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      return result;
    }

    void confirmPurchase()
      .then(async (result) => {
        if (!active || !result || !result.ok) {
          if (active) setStatus("error");
          return;
        }
        if (result.authTokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: result.authTokenHash,
            type: "email",
          });
          if (error) {
            if (active) setStatus("error");
            return;
          }
        }
        if (active) {
          setEntitlementId(result.entitlementId);
          setStatus("complete");
        }
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [confirmCheckout, sessionId]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <PlatformPage
        kicker="28-Day Fat Loss Accelerator"
        title={status === "complete" ? "You Own It" : "Confirming Your Purchase"}
        description={
          status === "complete"
            ? "Your Accelerator is now in My Programs. Day 1 has not started."
            : status === "error"
              ? "We could not finish opening your test purchase in this browser. No program was started."
              : "We’re checking your payment and account access."
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
                Start when you’re ready. Your 7-Day plan stays saved, and your nutrition tools are
                unlocked.
              </p>
              <Button asChild className="mt-5 w-full sm:w-auto">
                {entitlementId ? (
                  <Link to="/my-programs/accelerator/setup" search={{ entitlement: entitlementId }}>
                    Set Up My Accelerator
                  </Link>
                ) : (
                  <Link to="/my-programs">Open My Programs</Link>
                )}
              </Button>
              <p className="mt-4 text-sm text-muted-foreground">
                Your Nutrition is available from the main menu. Set your calorie and macro targets,
                then adjust how they fit across your meals.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Reload this page once. The signed webhook can still finish recording the purchase,
                and no program has been started automatically.
              </p>
              <Button asChild variant="outline" className="mt-5 w-full sm:w-auto">
                <Link to="/programs/accelerator">Return to Program</Link>
              </Button>
            </div>
          )}
        </section>
      </PlatformPage>
    </div>
  );
}
