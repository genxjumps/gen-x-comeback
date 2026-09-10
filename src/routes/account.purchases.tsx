import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import {
  getRefundPurchases,
  requestAcceleratorRefund,
  type RefundPurchasesResult,
} from "@/lib/commerce/refund.functions";

export const Route = createFileRoute("/account/purchases")({
  head: () => ({
    meta: [
      { title: "Purchases & Billing | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PurchasesAndBilling,
});
const date = (value: string) => new Date(value).toLocaleString();
function PurchasesAndBilling() {
  const load = useServerFn(getRefundPurchases);
  const submit = useServerFn(requestAcceleratorRefund);
  const [result, setResult] = useState<RefundPurchasesResult | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void load()
      .then((r) => active && setResult(r))
      .catch(() => active && setResult({ ok: false }));
    return () => {
      active = false;
    };
  }, [load]);
  async function request(purchaseId: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await submit({ data: { purchaseId } });
      if (response.outcome === "received") {
        setMessage(
          "Your request was received. Todd will review it. Your access stays available while the request is reviewed.",
        );
        setConfirm(null);
        setResult(await load());
      } else if (response.outcome === "refunded") {
        setMessage("This purchase has already been refunded.");
        setConfirm(null);
        setResult(await load());
      } else if (response.outcome === "ineligible") {
        setMessage("This purchase is no longer eligible for a new refund request.");
        setConfirm(null);
        setResult(await load());
      } else
        setMessage(
          "We couldn’t confirm your request. Try again - retrying won’t create a duplicate.",
        );
    } catch {
      setMessage(
        "We couldn’t confirm your request. Try again - retrying won’t create a duplicate.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <PlatformPage
      kicker="Account"
      title="Purchases & Billing"
      description="You can request a refund within seven days of purchase. Todd reviews requests and issues approved refunds through Stripe."
    >
      <p className="text-sm text-muted-foreground">
        Submitting a request doesn’t cancel your access. Accelerator access ends only after Stripe
        confirms a full refund. Your saved history remains.
      </p>
      {message ? (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      ) : null}
      {!result ? (
        <p className="mt-5">Loading your purchases...</p>
      ) : !result.ok ? (
        <div className="mt-5">
          <p>We couldn’t load your purchases.</p>
          <Button
            className="mt-3"
            onClick={() =>
              void load()
                .then(setResult)
                .catch(() => setResult({ ok: false }))
            }
          >
            Try Again
          </Button>
        </div>
      ) : result.purchases.length === 0 ? (
        <p className="mt-5">There aren’t any Accelerator purchases on this account.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {result.purchases.map((p) => (
            <section key={p.purchaseId} className="rounded-lg border border-border p-5">
              <h2 className="font-semibold">28-Day Fat Loss Accelerator - $37</h2>
              <p className="mt-2 text-sm">Purchased {date(p.purchasedAt)}</p>
              <p className="mt-1 text-sm">Request deadline: {date(p.deadline)} (your local time)</p>
              {p.purchaseStatus === "refunded" ? (
                <p className="mt-3">
                  Stripe confirmed your refund. Access from this purchase has ended.
                </p>
              ) : p.requestedAt ? (
                <p className="mt-3">
                  Request received {date(p.requestedAt)}. It’s saved for review, even if the request
                  deadline has now passed.
                </p>
              ) : p.canRequest ? (
                <div className="mt-4">
                  {confirm === p.purchaseId ? (
                    <div>
                      <p>Send a refund request for this purchase?</p>
                      <div className="mt-3 flex gap-3">
                        <Button disabled={busy} onClick={() => void request(p.purchaseId)}>
                          {busy ? "Sending..." : "Send Request"}
                        </Button>
                        <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>
                          Keep My Purchase
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => {
                        setConfirm(p.purchaseId);
                        setMessage(null);
                      }}
                    >
                      Request a Refund
                    </Button>
                  )}
                </div>
              ) : (
                <p className="mt-3">This purchase isn’t eligible for a new refund request.</p>
              )}
            </section>
          ))}
        </div>
      )}
      <Link to="/account" className="mt-6 inline-block text-sm underline">
        Back to Account
      </Link>
    </PlatformPage>
  );
}
