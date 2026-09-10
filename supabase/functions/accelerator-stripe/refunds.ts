// Provider reads only. No API in this module can create a refund or move money.
export type RefundCharge = {
  id: string;
  livemode: boolean;
  paid: boolean;
  amount: number;
  currency: string;
  payment_intent: string | { id: string } | null;
};
export type RefundSession = {
  id: string;
  livemode: boolean;
  mode: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  payment_intent: string | { id: string } | null;
  metadata: Record<string, string> | null;
};
export type ProviderRefund = {
  id: string;
  charge: string | { id: string } | null;
  amount: number;
  currency: string;
  status?: string | null;
};
export type RefundProvider = {
  charge(id: string): Promise<RefundCharge>;
  sessions(paymentIntent: string): Promise<RefundSession[]>;
  refunds(charge: string): AsyncIterable<ProviderRefund>;
};
export type ConfirmedRefund = {
  p_source_reference: string;
  p_charge_id: string;
  p_amount_cents: number;
  p_currency: string;
  p_refund_ids: string[];
};
const objectId = (value: string | { id: string } | null) =>
  typeof value === "string" ? value : value?.id;

export async function reconcileStripeRefund(
  chargeId: string,
  provider: RefundProvider,
  confirm: (evidence: ConfirmedRefund) => Promise<{ outcome: string }>,
): Promise<{ handled: boolean; outcome: string }> {
  if (!/^ch_[A-Za-z0-9]+$/.test(chargeId)) throw new Error("invalid_refund_charge");
  const charge = await provider.charge(chargeId);
  if (charge.id !== chargeId || charge.livemode !== false || !charge.paid)
    throw new Error("invalid_refund_charge");
  const intentId = objectId(charge.payment_intent);
  if (!intentId) return { handled: false, outcome: "unrelated" };
  const sessions = await provider.sessions(intentId);
  const matching = sessions.filter((s) => s.metadata?.genx_product_code === "accelerator_28");
  if (matching.length === 0) return { handled: false, outcome: "unrelated" };
  if (matching.length !== 1) throw new Error("ambiguous_refund_purchase");
  const session = matching[0];
  if (
    !/^cs_test_[A-Za-z0-9]+$/.test(session.id) ||
    session.livemode !== false ||
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    session.metadata?.genx_program_version !== "accelerator_28_v1" ||
    objectId(session.payment_intent) !== intentId ||
    session.amount_total !== 3700 ||
    session.currency?.toUpperCase() !== "USD" ||
    charge.amount !== 3700 ||
    charge.currency.toUpperCase() !== "USD"
  )
    throw new Error("invalid_refund_purchase");
  let succeeded = 0;
  const ids: string[] = [];
  const seen = new Set<string>();
  // Consume every page. Pending, failed, and canceled amounts never count.
  for await (const refund of provider.refunds(chargeId)) {
    if (
      objectId(refund.charge) !== chargeId ||
      refund.currency.toUpperCase() !== "USD" ||
      !/^re_[A-Za-z0-9]+$/.test(refund.id) ||
      seen.has(refund.id) ||
      !Number.isSafeInteger(refund.amount) ||
      refund.amount <= 0
    )
      throw new Error("invalid_refund_evidence");
    seen.add(refund.id);
    if (refund.status === "succeeded") {
      succeeded += refund.amount;
      ids.push(refund.id);
    }
  }
  if (succeeded > charge.amount) throw new Error("invalid_refund_total");
  if (succeeded !== charge.amount) return { handled: true, outcome: "not_fully_refunded" };
  const result = await confirm({
    p_source_reference: session.id,
    p_charge_id: chargeId,
    p_amount_cents: succeeded,
    p_currency: "USD",
    p_refund_ids: ids.sort(),
  });
  if (!["refunded", "replayed"].includes(result.outcome))
    throw new Error("refund_reconciliation_pending");
  return { handled: true, outcome: result.outcome };
}
