import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, RotateCcw } from "lucide-react";
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
        kicker={
          status === "complete"
            ? "You Own It"
            : status === "checking"
              ? "Purchase Received"
              : "28-Day Fat Loss Accelerator"
        }
        title={
          status === "complete"
            ? "Your New Program Is Ready"
            : status === "checking"
              ? "We’re Finishing Your Purchase"
              : "Confirming Your Purchase"
        }
        description={
          status === "complete"
            ? "You can find your 28-Day Fat Loss Accelerator under My Programs."
            : status === "error"
              ? "We could not finish opening your test purchase in this browser. No program was started."
              : "Your payment went through. We’re adding your 28-Day Fat Loss Accelerator to My Programs."
        }
      >
        <section className="border-y border-[var(--pu-border-strong)] py-6">
          {status === "checking" ? (
            <div>
              <div className="flex gap-4">
                <span className="grid size-11 shrink-0 animate-spin place-items-center rounded-full bg-foreground text-background">
                  <RotateCcw aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="font-bold">This usually takes only a moment</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Wait here, or tap Check Again if the page doesn’t update.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                className="mt-5 w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                Check Again
              </Button>
            </div>
          ) : status === "complete" ? (
            <div>
              <div className="grid size-11 place-items-center rounded-full bg-[var(--pu-status-success)] text-white">
                <Check className="size-5" />
              </div>
              <p className="mt-4 font-bold">No email check needed</p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Set it up now or come back when you’re ready.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button asChild className="w-full sm:w-auto">
                  {entitlementId ? (
                    <Link
                      to="/my-programs/accelerator/setup"
                      search={{ entitlement: entitlementId }}
                    >
                      Set Up My Accelerator
                    </Link>
                  ) : (
                    <Link to="/my-programs">Open Programs</Link>
                  )}
                </Button>
                {entitlementId ? (
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link to="/my-programs">Open Programs</Link>
                  </Button>
                ) : null}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                <Link to="/nutrition" className="font-medium text-foreground underline">
                  Open Nutrition
                </Link>{" "}
                to set your calorie and macro targets, then adjust how they fit across your meals.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Reload this page once. We may be able to record your purchase. No program has been
                started automatically.
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
