import { beforeEach, expect, it, vi } from "vitest";
import { hashAccessToken } from "@/lib/lead-plan";
import { exchangePaidAccessToken } from "@/lib/account/paid-access-exchange.server";
import { resolveAcceleratorAccess } from "@/lib/accelerator/access.server";

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  generateLink: vi.fn(),
  getUserById: vi.fn(),
}));
vi.mock("@/lib/account/customer-account.server", () => ({
  resolveCustomerAccount: async () => ({ ok: true, account: { id: "customer" } }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { admin: { generateLink: fixture.generateLink, getUserById: fixture.getUserById } },
    from: (table: string) => {
      let rows = fixture.rows[table] ?? [];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((row) => row[key] === value);
          return query;
        },
        is: (key: string, value: unknown) => query.eq(key, value),
        limit: async () => ({ data: rows, error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
      return query;
    },
  },
}));
const raw = "a".repeat(43);
beforeEach(async () => {
  vi.clearAllMocks();
  fixture.rows = {
    paid_access_tokens: [
      {
        token_id: "token",
        job_id: "job",
        customer_id: "customer",
        entitlement_id: null,
        token_hash: await hashAccessToken(raw),
        expires_at: "2099-01-01",
        revoked_at: null,
        use_count: 0,
      },
    ],
    paid_access_email_jobs: [
      { job_id: "job", customer_id: "customer", entitlement_id: null, job_type: "paid_recovery" },
    ],
    paid_product_entitlements: [
      {
        id: "entitlement",
        customer_id: "customer",
        product_code: "accelerator_28",
        status: "revoked",
      },
    ],
    customer_accounts: [
      { id: "customer", auth_user_id: "auth", email_original: "buyer@example.test" },
    ],
  };
  fixture.getUserById.mockResolvedValue({
    data: { user: { id: "auth", email: "buyer@example.test" } },
    error: null,
  });
  fixture.generateLink.mockResolvedValue({
    data: { user: { id: "auth" }, properties: { hashed_token: "handoff" } },
    error: null,
  });
});
it("signs in to the existing refunded account repeatedly without granting workout access", async () => {
  const before = JSON.stringify(fixture.rows);
  for (let i = 0; i < 2; i++) {
    expect(await exchangePaidAccessToken(raw)).toEqual({
      ok: true,
      destination: "/my-programs",
      platformAuthTokenHash: "handoff",
    });
    expect(await resolveAcceleratorAccess("verified-session")).toBeNull();
  }
  expect(JSON.stringify(fixture.rows)).toBe(before);
});
it("rejects expired and revoked account credentials before generating a handoff", async () => {
  const token = fixture.rows.paid_access_tokens![0]!;
  token.expires_at = "2000-01-01";
  expect(await exchangePaidAccessToken(raw)).toEqual({ ok: false });
  token.expires_at = "2099-01-01";
  token.revoked_at = "2026-09-10";
  expect(await exchangePaidAccessToken(raw)).toEqual({ ok: false });
  expect(fixture.generateLink).not.toHaveBeenCalled();
});
it("rejects legacy entitlement-bound recovery after refund", async () => {
  fixture.rows.paid_access_tokens![0]!.entitlement_id = "entitlement";
  expect(await exchangePaidAccessToken(raw)).toEqual({ ok: false });
  expect(fixture.generateLink).not.toHaveBeenCalled();
});
it("rejects a token whose account-scoped job belongs to another customer", async () => {
  fixture.rows.paid_access_email_jobs![0]!.customer_id = "other";
  expect(await exchangePaidAccessToken(raw)).toEqual({ ok: false });
  expect(fixture.generateLink).not.toHaveBeenCalled();
});
it("rejects a missing or mismatched Auth identity without creating another one", async () => {
  fixture.getUserById.mockResolvedValue({
    data: { user: { email: "other@example.test" } },
    error: null,
  });
  expect(await exchangePaidAccessToken(raw)).toEqual({ ok: false });
  expect(fixture.generateLink).not.toHaveBeenCalled();
});
it("preserves active entitlement-bound purchase access", async () => {
  fixture.rows.paid_access_tokens![0]!.entitlement_id = "entitlement";
  fixture.rows.paid_product_entitlements![0]!.status = "active";
  expect((await exchangePaidAccessToken(raw)).ok).toBe(true);
});
