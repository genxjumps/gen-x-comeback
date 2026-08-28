import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAcceleratorAccess } from "../access.server";

const { resolveCustomerAccount, from } = vi.hoisted(() => ({
  resolveCustomerAccount: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/account/customer-account.server", () => ({ resolveCustomerAccount }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from },
}));

function chain(result: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "in", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.limit = vi.fn(async () => result);
  return query;
}

describe("unified-account Accelerator access", () => {
  beforeEach(() => {
    resolveCustomerAccount.mockReset();
    from.mockReset();
  });

  it("fails closed when the verified customer account cannot be resolved", async () => {
    resolveCustomerAccount.mockResolvedValue({ ok: false });
    await expect(resolveAcceleratorAccess("Bearer verified.jwt.token")).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("resolves the newest owned run without a paid browser credential", async () => {
    resolveCustomerAccount.mockResolvedValue({
      ok: true,
      account: { id: "account-1", firstName: "Todd", email: "t@example.com", linkedLeadPlans: 1 },
      replayed: true,
    });
    from
      .mockReturnValueOnce(chain({ data: [{ id: "entitlement-1" }], error: null }))
      .mockReturnValueOnce(
        chain({
          data: [{ id: "run-2", program_version: "accelerator_28_v1" }],
          error: null,
        }),
      );

    await expect(resolveAcceleratorAccess("Bearer verified.jwt.token")).resolves.toEqual({
      customerAccountId: "account-1",
      enrollmentId: "run-2",
      programVersion: "accelerator_28_v1",
      firstName: "Todd",
    });
    expect(from).toHaveBeenNthCalledWith(1, "paid_product_entitlements");
    expect(from).toHaveBeenNthCalledWith(2, "paid_program_enrollments");
  });
});
