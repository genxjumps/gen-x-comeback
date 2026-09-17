import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveNutritionAccess } from "../access.server";

const { resolveCustomerAccount, from } = vi.hoisted(() => ({
  resolveCustomerAccount: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/account/customer-account.server", () => ({ resolveCustomerAccount }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));

function chain(result: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "in"]) query[method] = vi.fn(() => query);
  query.limit = vi.fn(async () => result);
  return query;
}

describe("account-level nutrition access", () => {
  beforeEach(() => {
    resolveCustomerAccount.mockReset();
    from.mockReset();
  });

  it("fails closed when the verified customer account cannot be resolved", async () => {
    resolveCustomerAccount.mockResolvedValue({ ok: false });
    await expect(resolveNutritionAccess("Bearer verified.jwt.token")).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("unlocks from active ownership without requiring an Accelerator run", async () => {
    resolveCustomerAccount.mockResolvedValue({
      ok: true,
      account: { id: "account-1", firstName: "Todd", email: "t@example.com", linkedLeadPlans: 1 },
      replayed: true,
    });
    from.mockReturnValue(chain({ data: [{ id: "entitlement-1" }], error: null }));

    await expect(resolveNutritionAccess("Bearer verified.jwt.token")).resolves.toEqual({
      customerAccountId: "account-1",
      firstName: "Todd",
      eligible: true,
    });
    expect(from).toHaveBeenCalledWith("paid_product_entitlements");
  });

  it("returns a locked account without deleting saved nutrition data", async () => {
    resolveCustomerAccount.mockResolvedValue({
      ok: true,
      account: { id: "account-1", firstName: null, email: "t@example.com", linkedLeadPlans: 1 },
      replayed: true,
    });
    from.mockReturnValue(chain({ data: [], error: null }));

    await expect(resolveNutritionAccess("Bearer verified.jwt.token")).resolves.toEqual({
      customerAccountId: "account-1",
      firstName: "Jumper",
      eligible: false,
    });
  });
});
