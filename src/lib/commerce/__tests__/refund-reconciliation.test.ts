import { describe, it, expect, vi } from "vitest";
import {
  reconcileStripeRefund,
  type RefundProvider,
  type ProviderRefund,
} from "../../../../supabase/functions/accelerator-stripe/refunds";
const charge = {
  id: "ch_one",
  livemode: false,
  paid: true,
  amount: 3700,
  currency: "usd",
  payment_intent: "pi_one",
};
const session = {
  id: "cs_test_one",
  livemode: false,
  mode: "payment",
  payment_status: "paid",
  amount_total: 3700,
  currency: "usd",
  payment_intent: "pi_one",
  metadata: { genx_product_code: "accelerator_28", genx_program_version: "accelerator_28_v1" },
};
function fixture(
  refunds: ProviderRefund[] = [
    { id: "re_one", charge: "ch_one", amount: 3700, currency: "usd", status: "succeeded" },
  ],
) {
  const provider: RefundProvider = {
    charge: vi.fn(async () => charge),
    sessions: vi.fn(async () => [session]),
    refunds: async function* () {
      for (const r of refunds) yield r;
    },
  };
  const confirm = vi.fn(async () => ({ outcome: "refunded" }));
  return { provider, confirm };
}
describe("verified Stripe refund reconciliation", () => {
  it("confirms only a fresh test charge and its matching paid checkout", async () => {
    const { provider, confirm } = fixture();
    await expect(reconcileStripeRefund("ch_one", provider, confirm)).resolves.toEqual({
      handled: true,
      outcome: "refunded",
    });
    expect(confirm).toHaveBeenCalledWith({
      p_source_reference: "cs_test_one",
      p_charge_id: "ch_one",
      p_amount_cents: 3700,
      p_currency: "USD",
      p_refund_ids: ["re_one"],
    });
  });
  it.each(["pending", "failed", "canceled", "requires_action", null])(
    "keeps access for refund status %s",
    async (status) => {
      const { provider, confirm } = fixture([
        { id: "re_one", charge: "ch_one", amount: 3700, currency: "usd", status },
      ]);
      expect(await reconcileStripeRefund("ch_one", provider, confirm)).toEqual({
        handled: true,
        outcome: "not_fully_refunded",
      });
      expect(confirm).not.toHaveBeenCalled();
    },
  );
  it("keeps access after a partial success plus a pending balance", async () => {
    const { provider, confirm } = fixture([
      { id: "re_one", charge: "ch_one", amount: 1000, currency: "usd", status: "succeeded" },
      { id: "re_two", charge: "ch_one", amount: 2700, currency: "usd", status: "pending" },
    ]);
    await reconcileStripeRefund("ch_one", provider, confirm);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("consumes all pages and sums multiple successful refunds", async () => {
    const { provider, confirm } = fixture([
      { id: "re_one", charge: "ch_one", amount: 1000, currency: "usd", status: "succeeded" },
      { id: "re_two", charge: "ch_one", amount: 2700, currency: "usd", status: "succeeded" },
    ]);
    await reconcileStripeRefund("ch_one", provider, confirm);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ p_amount_cents: 3700, p_refund_ids: ["re_one", "re_two"] }),
    );
  });
  it.each([
    { livemode: true },
    { id: "ch_wrong" },
    { paid: false },
    { amount: 4000 },
    { currency: "eur" },
  ])("rejects invalid charge %j", async (change) => {
    const { provider, confirm } = fixture();
    provider.charge = async () => ({ ...charge, ...change });
    await expect(reconcileStripeRefund("ch_one", provider, confirm)).rejects.toThrow();
    expect(confirm).not.toHaveBeenCalled();
  });
  it.each([
    { livemode: true },
    { payment_intent: "pi_other" },
    { amount_total: 4000 },
    { id: "cs_live_one" },
    { metadata: { genx_product_code: "accelerator_28", genx_program_version: "wrong" } },
  ])("rejects mismatched checkout %j", async (change) => {
    const { provider, confirm } = fixture();
    provider.sessions = async () => [{ ...session, ...change }];
    await expect(reconcileStripeRefund("ch_one", provider, confirm)).rejects.toThrow();
    expect(confirm).not.toHaveBeenCalled();
  });
  it("ignores unrelated Stripe purchases without touching access", async () => {
    const { provider, confirm } = fixture();
    provider.sessions = async () => [{ ...session, metadata: {} }];
    expect(await reconcileStripeRefund("ch_one", provider, confirm)).toEqual({
      handled: false,
      outcome: "unrelated",
    });
    expect(confirm).not.toHaveBeenCalled();
  });
  it.each([{ charge: "ch_other" }, { currency: "eur" }, { amount: -1 }, { amount: 3701 }])(
    "rejects malformed refund evidence %j",
    async (change) => {
      const { provider, confirm } = fixture([
        {
          id: "re_one",
          charge: "ch_one",
          amount: 3700,
          currency: "usd",
          status: "succeeded",
          ...change,
        },
      ]);
      await expect(reconcileStripeRefund("ch_one", provider, confirm)).rejects.toThrow();
      expect(confirm).not.toHaveBeenCalled();
    },
  );
  it("does not count the same refund twice", async () => {
    const refund = {
      id: "re_one",
      charge: "ch_one",
      amount: 1850,
      currency: "usd",
      status: "succeeded",
    };
    const { provider, confirm } = fixture([refund, refund]);
    await expect(reconcileStripeRefund("ch_one", provider, confirm)).rejects.toThrow();
    expect(confirm).not.toHaveBeenCalled();
  });
  it("requires retry when a refund arrives before purchase fulfillment", async () => {
    const { provider, confirm } = fixture();
    confirm.mockResolvedValue({ outcome: "purchase_pending" });
    await expect(reconcileStripeRefund("ch_one", provider, confirm)).rejects.toThrow(
      "refund_reconciliation_pending",
    );
  });
  it("accepts idempotent database replay", async () => {
    const { provider, confirm } = fixture();
    confirm.mockResolvedValue({ outcome: "replayed" });
    expect((await reconcileStripeRefund("ch_one", provider, confirm)).outcome).toBe("replayed");
  });
  it("does not acknowledge a provider or database outage", async () => {
    const { provider, confirm } = fixture();
    confirm.mockRejectedValue(Error("offline"));
    await expect(reconcileStripeRefund("ch_one", provider, confirm)).rejects.toThrow();
    provider.charge = async () => {
      throw Error("provider offline");
    };
    confirm.mockClear();
    await expect(reconcileStripeRefund("ch_one", provider, confirm)).rejects.toThrow();
    expect(confirm).not.toHaveBeenCalled();
  });
});
