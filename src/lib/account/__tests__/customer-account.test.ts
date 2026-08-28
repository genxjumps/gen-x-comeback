import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveCustomerAccount,
  resolveVerifiedCustomerIdentity,
} from "../customer-account.server";

const { getUser, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser },
    rpc,
  },
}));

const AUTHORIZATION = "Bearer header.payload.signature";

function verifiedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "auth-user-1",
    email: "Todd@Example.com",
    email_confirmed_at: "2026-08-28T20:30:00.000Z",
    is_anonymous: false,
    user_metadata: { first_name: " Todd " },
    ...overrides,
  };
}

describe("unified customer account foundation", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset();
    getUser.mockResolvedValue({ data: { user: verifiedUser() }, error: null });
    rpc.mockResolvedValue({
      data: [
        {
          outcome: "created",
          customer_id: "customer-1",
          customer_first_name: "Todd",
          linked_lead_plans: 1,
          replayed: false,
        },
      ],
      error: null,
    });
  });

  it("rejects missing and malformed bearer credentials before provider or database access", async () => {
    await expect(resolveCustomerAccount(null)).resolves.toEqual({ ok: false });
    await expect(resolveCustomerAccount("Bearer not-a-jwt")).resolves.toEqual({ ok: false });

    expect(getUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires a non-anonymous user with a confirmed email", async () => {
    for (const user of [
      verifiedUser({ email_confirmed_at: null }),
      verifiedUser({ email: null }),
      verifiedUser({ is_anonymous: true }),
    ]) {
      getUser.mockResolvedValueOnce({ data: { user }, error: null });
      await expect(resolveVerifiedCustomerIdentity(AUTHORIZATION)).resolves.toBeNull();
    }

    expect(rpc).not.toHaveBeenCalled();
  });

  it("normalizes only a provider-verified identity before resolving the account", async () => {
    const result = await resolveCustomerAccount(AUTHORIZATION);

    expect(getUser).toHaveBeenCalledWith("header.payload.signature");
    expect(rpc).toHaveBeenCalledWith("resolve_verified_customer_account", {
      p_auth_user_id: "auth-user-1",
      p_email_normalized: "todd@example.com",
      p_email_original: "Todd@Example.com",
      p_email_verified_at: "2026-08-28T20:30:00.000Z",
      p_first_name: "Todd",
    });
    expect(result).toEqual({
      ok: true,
      account: {
        id: "customer-1",
        email: "todd@example.com",
        firstName: "Todd",
        linkedLeadPlans: 1,
      },
      replayed: false,
    });
  });

  it("returns the same account safely on an exact replay", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          outcome: "replayed",
          customer_id: "customer-1",
          customer_first_name: "Todd",
          linked_lead_plans: 0,
          replayed: true,
        },
      ],
      error: null,
    });

    await expect(resolveCustomerAccount(AUTHORIZATION)).resolves.toMatchObject({
      ok: true,
      replayed: true,
      account: { id: "customer-1", linkedLeadPlans: 0 },
    });
  });

  it("keeps conflicts and rejected account resolution non-enumerating", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          outcome: "conflict",
          customer_id: null,
          customer_first_name: null,
          linked_lead_plans: 0,
          replayed: false,
        },
      ],
      error: null,
    });

    await expect(resolveCustomerAccount(AUTHORIZATION)).resolves.toEqual({ ok: false });
  });
});
