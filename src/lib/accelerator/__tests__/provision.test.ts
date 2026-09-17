import { beforeEach, describe, expect, it, vi } from "vitest";

import { provisionAcceleratorOwnership } from "../provision.server";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc },
}));

const PURCHASE = {
  customerAccountId: "00000000-0000-4000-8000-000000000001",
  idempotencyKey: "checkout-event-1",
  purchaseSource: "future_test_checkout",
  sourceReference: "purchase-1",
  purchasedAt: "2026-08-28T18:00:00.000Z",
};

describe("trusted Accelerator ownership provisioning", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({
      data: [
        {
          outcome: "created",
          purchase_id: "purchase-1",
          entitlement_id: "entitlement-1",
          replayed: false,
        },
      ],
      error: null,
    });
  });

  it("records the locked offer against the unified customer account", async () => {
    const result = await provisionAcceleratorOwnership(PURCHASE);

    expect(result).toEqual({
      purchaseId: "purchase-1",
      entitlementId: "entitlement-1",
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, input] = rpc.mock.calls[0];
    expect(name).toBe("provision_accelerator_ownership");
    expect(input).toMatchObject({
      p_customer_id: PURCHASE.customerAccountId,
      p_product_code: "accelerator_28",
      p_amount_cents: 3700,
      p_currency: "USD",
    });
    expect(input).not.toHaveProperty("p_program_version");
    expect(input).not.toHaveProperty("p_program_snapshot");
  });

  it("creates the same request fingerprint for an exact retry", async () => {
    await provisionAcceleratorOwnership(PURCHASE);
    await provisionAcceleratorOwnership(PURCHASE);
    expect(rpc.mock.calls[0][1].p_request_fingerprint).toBe(
      rpc.mock.calls[1][1].p_request_fingerprint,
    );
  });

  it("rejects malformed trusted input before touching the database", async () => {
    await expect(
      provisionAcceleratorOwnership({ ...PURCHASE, customerAccountId: "not-a-uuid" }),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
