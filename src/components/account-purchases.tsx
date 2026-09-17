import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  AppList,
  AppListRow,
  AppLoadingState,
  AppNotice,
  AppStatePanel,
} from "@/components/precision-surfaces";
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

function purchaseStatusLabel(status: string, requestedAt: string | null) {
  if (status === "refunded") return "Refunded";
  if (requestedAt) return "Refund Requested";
  if (status === "disputed") return "Disputed";
  if (status === "canceled") return "Canceled";
  return "Paid";
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
      <h2 id="purchases-heading" className="text-xl font-bold">
        Purchases &amp; Billing
      </h2>

      {message ? (
        <AppNotice tone="info" className="mt-4" role="status">
          {message}
        </AppNotice>
      ) : null}

      {!result ? (
        <AppLoadingState label="Loading your purchases" className="mt-5" />
      ) : !result.ok ? (
        <AppStatePanel
          state="error"
          title="Purchases couldn’t be loaded"
          description="Try again to reload your purchase history."
          className="mt-5"
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
        <AppStatePanel
          state="empty"
          title="No Accelerator purchases yet"
          description="Any eligible paid program purchase will appear here."
          className="mt-5"
        />
      ) : (
        <AppList className="mt-5">
          {result.purchases.map((p) => (
            <AppListRow
              key={p.purchaseId}
              title="28-Day Fat Loss Accelerator"
              end={
                <div className="text-right">
                  <div className="font-bold tabular-nums text-[var(--pu-text-primary)]">$37</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--pu-text-secondary)]">
                    {purchaseStatusLabel(p.purchaseStatus, p.requestedAt)}
                  </div>
                </div>
              }
              detail={
                <div>
                  <p>Purchased {date(p.purchasedAt)}</p>
                  {p.purchaseStatus === "refunded" ? (
                    <p className="mt-2">Access from this purchase has ended.</p>
                  ) : p.requestedAt ? (
                    <p className="mt-2">
                      Submitted {date(p.requestedAt)}. Todd will review your request.
                    </p>
                  ) : p.canRequest ? (
                    <div className="mt-3">
                      <p>
                        7-day guarantee. Request a refund by {deadline(p.deadline)} (your local time).
                      </p>
                      {confirm === p.purchaseId ? (
                        <div className="mt-3 border-l-4 border-[var(--pu-status-warning)] pl-4">
                          <p className="font-bold text-[var(--pu-text-primary)]">
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
                    <p className="mt-2">Refund requests are closed for this purchase.</p>
                  )}
                </div>
              }
            />
          ))}
        </AppList>
      )}
    </section>
  );
}
