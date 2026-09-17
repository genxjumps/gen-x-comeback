import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  getRefundPurchases,
  requestAcceleratorRefund,
  type RefundPurchasesResult,
} from "@/lib/commerce/refund.functions";

const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
const deadline = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
export function AccountPurchases() {
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
    <section
      id="purchases"
      aria-labelledby="purchases-heading"
      className="mt-10 scroll-mt-24 border-t border-border pt-8"
    >
      <h2 id="purchases-heading" className="text-xl font-semibold">
        Purchases &amp; Billing
      </h2>
      {message ? (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      ) : null}
      {!result ? (
        <p className="mt-5">Loading your purchases...</p>
      ) : !result.ok ? (
        <div className="mt-5">
          <p role="alert">We couldn’t load your purchases.</p>
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
        <p className="mt-5">No Accelerator purchases yet.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {result.purchases.map((p) => (
            <section key={p.purchaseId} className="border-b border-border py-6 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">28-Day Fat Loss Accelerator</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Purchased {date(p.purchasedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold tabular-nums">$37</p>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                    {p.purchaseStatus === "refunded"
                      ? "Refunded"
                      : p.requestedAt
                        ? "Refund Requested"
                        : p.purchaseStatus === "disputed"
                          ? "Disputed"
                          : p.purchaseStatus === "canceled"
                            ? "Canceled"
                            : "Paid"}
                  </span>
                </div>
              </div>
              {p.purchaseStatus === "refunded" ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Access from this purchase has ended.
                </p>
              ) : p.requestedAt ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Submitted {date(p.requestedAt)}. Todd will review your request.
                </p>
              ) : p.canRequest ? (
                <div className="mt-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    7-day guarantee. Request a refund by {deadline(p.deadline)} (your local time).
                  </p>
                  {confirm === p.purchaseId ? (
                    <div>
                      <p>Send a refund request for this purchase?</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Todd reviews requests. Your access stays available until a full refund is
                        confirmed.
                      </p>
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
                <p className="mt-3 text-sm text-muted-foreground">
                  Refund requests are closed for this purchase.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
