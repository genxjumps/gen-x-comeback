import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import { getRefundQueue, type RefundQueueResult } from "@/lib/commerce/refund.functions";
export const Route = createFileRoute("/admin/refunds")({
  head: () => ({
    meta: [
      { title: "Private Refund Review | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RefundReview,
});
function RefundReview() {
  const load = useServerFn(getRefundQueue);
  const [result, setResult] = useState<RefundQueueResult | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void load()
      .then((r) => active && setResult(r))
      .catch(() => active && setResult({ ok: false }));
    return () => {
      active = false;
    };
  }, [load]);
  async function refresh() {
    setBusy(true);
    try {
      setResult(await load());
    } catch {
      setResult({ ok: false });
    } finally {
      setBusy(false);
    }
  }
  if (!result) return <p>Loading refund requests...</p>;
  if (!result.ok)
    return (
      <div>
        <p>Refund review isn’t available for this account or couldn’t be loaded.</p>
        <Button className="mt-3" disabled={busy} onClick={() => void refresh()}>
          Try Again
        </Button>
      </div>
    );
  return (
    <PlatformPage
      kicker="Private review"
      title="Refund Requests"
      description="Review the recorded request time, find the matching purchase in Stripe, and issue approved refunds there. This page can’t issue refunds or change access."
    >
      <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
        {busy ? "Refreshing..." : "Refresh Status"}
      </Button>
      {result.requests.length === 0 ? (
        <p className="mt-5">No refund requests.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {result.requests.map((r) => (
            <article key={r.requestId} className="rounded-lg border border-border p-5">
              <h2 className="font-semibold break-all">{r.customerEmail}</h2>
              <p className="mt-2">
                {r.status === "refunded"
                  ? "Stripe-confirmed refund"
                  : "Awaiting review / Stripe confirmation"}{" "}
                - $37 USD
              </p>
              <p className="mt-2 text-sm">Requested: {new Date(r.requestedAt).toLocaleString()}</p>
              <p className="text-sm">Deadline: {new Date(r.deadline).toLocaleString()}</p>
              <p className="mt-2 break-all text-sm">
                Stripe Checkout Session: {r.checkoutSessionId}
              </p>
              <p className="text-xs break-all">Request reference: {r.requestId}</p>
              {r.refundedAt ? (
                <p className="mt-2 text-sm">Confirmed: {new Date(r.refundedAt).toLocaleString()}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </PlatformPage>
  );
}
