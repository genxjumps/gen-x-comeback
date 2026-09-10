import { beforeEach, describe, it, expect, vi } from "vitest";
const io = vi.hoisted(() => ({ resolve: vi.fn(), rpc: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const handler = (fn: (args: unknown) => unknown) => fn;
    return {
      handler,
      validator: (validate: (data: unknown) => unknown) => ({
        handler: (fn: (args: { data: unknown }) => unknown) => (args: { data: unknown }) =>
          fn({ data: validate(args.data) }),
      }),
    };
  },
}));
vi.mock("@/lib/account/customer-account.server", () => ({
  currentAuthorizationHeader: () => null,
  resolveCustomerAccount: io.resolve,
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: io.rpc } }));
import { getRefundPurchases, getRefundQueue, requestAcceleratorRefund } from "../refund.functions";
const customer = "00000000-0000-4000-8000-000000000001";
const purchase = "00000000-0000-4000-8000-000000000002";
beforeEach(() => {
  vi.clearAllMocks();
  io.resolve.mockResolvedValue({ ok: true, account: { id: customer } });
  io.rpc.mockResolvedValue({ data: [], error: null });
});
describe("refund server authorization and errors", () => {
  it("binds the request to the verified account", async () => {
    io.rpc.mockResolvedValue({ data: { outcome: "received", requestId: purchase }, error: null });
    expect(await requestAcceleratorRefund({ data: { purchaseId: purchase } })).toMatchObject({
      outcome: "received",
    });
    expect(io.rpc).toHaveBeenCalledWith("request_accelerator_refund", {
      p_customer_id: customer,
      p_purchase_id: purchase,
    });
  });
  it("rejects client-supplied customer IDs", async () => {
    expect(() =>
      requestAcceleratorRefund({ data: { purchaseId: purchase, customerId: "attacker" } as never }),
    ).toThrow();
    expect(io.rpc).not.toHaveBeenCalled();
  });
  it("denies all private calls without authentication", async () => {
    io.resolve.mockResolvedValue({ ok: false });
    expect(await getRefundPurchases()).toEqual({ ok: false });
    expect(await getRefundQueue()).toEqual({ ok: false });
    expect(await requestAcceleratorRefund({ data: { purchaseId: purchase } })).toEqual({
      outcome: "unavailable",
    });
    expect(io.rpc).not.toHaveBeenCalled();
  });
  it("lets the database enforce the separate reviewer role", async () => {
    io.rpc.mockResolvedValue({ data: null, error: null });
    expect(await getRefundQueue()).toEqual({ ok: false });
    expect(io.rpc).toHaveBeenCalledWith("get_accelerator_refund_queue", {
      p_reviewer_id: customer,
    });
  });
  it("returns a retryable message on a failed request without false receipt", async () => {
    io.rpc.mockRejectedValue(Error("offline"));
    expect(await requestAcceleratorRefund({ data: { purchaseId: purchase } })).toEqual({
      outcome: "unavailable",
    });
  });
  it("fails safely for database errors and malformed private results", async () => {
    io.rpc.mockResolvedValue({ data: [{ secret: "do not expose" }], error: null });
    expect(await getRefundPurchases()).toEqual({ ok: false });
    io.rpc.mockResolvedValue({ data: [], error: { message: "internal" } });
    expect(await getRefundQueue()).toEqual({ ok: false });
  });
});
