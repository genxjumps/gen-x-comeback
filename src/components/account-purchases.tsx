import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppList, AppListRow } from "@/components/app-list";
import { AppLoading, AppNotice, AppState } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import {
  getRefundPurchases,
  requestAcceleratorRefund,
  type RefundPurchase,
  type RefundPurchasesResult,
} from "@/lib/commerce/refund.functions";

const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
const deadline = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function purchaseStatusLabel(purchase: RefundPurchase) {
  return purchase.purchaseStatus === "refunded"
    ? "Refunded"
    : purchase.requestedAt
      ? "Refund Requested"
      : purchase.purchaseStatus === "disputed"
        ? "Disputed"
        : purchase.purchaseStatus === "canceled"
          ? "Canceled"
          : "Paid";
}

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
      } else {
        setMessage(
          "We couldn’t confirm your request. Try again - retrying won’t create a duplicate.",
        );
      }
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
      className="mt-10 scroll-mt-24 border-t border-[var(--pu-border-strong)] pt-8"
    >
      <h2 id="purchases-heading" className="text-xl font-semibold">
        Purchases &amp; Billing
      </h2>

      {message ? (
        <AppNotice tone="info" className="mt-4" role="status">
          {message}
        </AppNotice>
      ) : null}

      {!result ? (
        <AppLoading className="mt-5" />
      ) : !result.ok ? (
        <AppState
          className="mt-5"
          state="error"
          title="Purchases Couldn't Be Loaded"
          description="Try again. Nothing about your purchases or access was changed."
          action={
            <Button
              onClick={() =>
                void load()
                  .then(setResult)
                  .catch(() => setResult({ ok: false }))
              }
            >
              Try Again
            </Button>
          }
        />
      ) : result.purchases.length === 0 ? (
        <AppState
          className="mt-5"
          state="empty"
          title="No Accelerator Purchases Yet"
          description="Your completed purchases will appear here."
        />
      ) : (
        <AppList className="mt-5">
          {result.purchases.map((p) => {
            const detail = (
              <div className="space-y-3">
                <p>Purchased {date(p.purchasedAt)}</p>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]">
                  {purchaseStatusLabel(p)} · $37
                </p>

                {p.purchaseStatus === "refunded" ? (
                  <p>Access from this purchase has ended.</p>
                ) : p.requestedAt ? (
                  <p>Submitted {date(p.requestedAt)}. Todd will review your request.</p>
                ) : p.canRequest ? (
                  <div>
                    <p>
                      7-day guarantee. Request a refund by {deadline(p.deadline)} (your local time).
                    </p>
                    {confirm === p.purchaseId ? (
                      <div className="mt-3 border-l-4 border-[var(--pu-status-warning)] pl-4">
                        <p className="font-semibold text-[var(--pu-text-primary)]">
                          Send a refund request for this purchase?
                        </p>
                        <p className="mt-1">
                          Todd reviews requests. Your access stays available until a full refund is
                          confirmed.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <Button disabled={busy} onClick={() => void request(p.purchaseId)}>
                            {busy ? "Sending..." : "Send Request"}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setConfirm(null)}
                          >
                            Keep My Purchase
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="mt-3"
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
                  <p>Refund requests are closed for this purchase.</p>
                )}
              </div>
            );

            return (
              <AppListRow key={p.purchaseId} title="28-Day Fat Loss Accelerator" detail={detail} />
            );
          })}
        </AppList>
      )}
    </section>
  );
}
