import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateAcceleratorAccessToken,
  provisionAcceleratorEnrollment,
} from "../provision.server";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc },
}));

const PURCHASE = {
  idempotencyKey: "checkout-event-1",
  email: "  Todd@Example.com ",
  firstName: " Todd ",
  purchaseSource: "future_test_checkout",
  sourceReference: "purchase-1",
  purchasedAt: "2026-08-28T18:00:00.000Z",
  rawAccessToken: "a".repeat(43),
};

describe("trusted Accelerator enrollment provisioning", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({
      data: [{ outcome: "created", enrollment_id: "enrollment-1", replayed: false }],
      error: null,
    });
  });

  it("normalizes identity and sends the locked offer and version snapshot", async () => {
    const result = await provisionAcceleratorEnrollment(PURCHASE);

    expect(result).toEqual({
      enrollmentId: "enrollment-1",
      rawAccessToken: PURCHASE.rawAccessToken,
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, input] = rpc.mock.calls[0];
    expect(name).toBe("provision_accelerator_enrollment");
    expect(input).toMatchObject({
      p_email_normalized: "todd@example.com",
      p_email_original: "Todd@Example.com",
      p_first_name: "Todd",
      p_product_code: "accelerator_28",
      p_amount_cents: 3700,
      p_currency: "USD",
      p_program_version: "accelerator_28_v1",
    });
    expect(input.p_program_snapshot.days).toHaveLength(28);
    expect(input.p_access_token_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates the same request fingerprint for an exact retry", async () => {
    await provisionAcceleratorEnrollment(PURCHASE);
    await provisionAcceleratorEnrollment(PURCHASE);

    expect(rpc.mock.calls[0][1].p_request_fingerprint).toBe(
      rpc.mock.calls[1][1].p_request_fingerprint,
    );
  });

  it("rejects malformed trusted input before touching the database", async () => {
    await expect(
      provisionAcceleratorEnrollment({ ...PURCHASE, email: "not-an-email" }),
    ).rejects.toThrow();
    await expect(
      provisionAcceleratorEnrollment({ ...PURCHASE, rawAccessToken: "too-short" }),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("generates 32-byte opaque base64url credentials", () => {
    expect(generateAcceleratorAccessToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
