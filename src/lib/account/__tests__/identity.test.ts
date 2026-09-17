import { beforeEach, describe, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({
  identity: vi.fn(),
  plan: vi.fn(),
  from: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
    validator: (validate: (data: unknown) => unknown) => ({
      handler: (fn: (args: { data: unknown }) => unknown) => (args: { data: unknown }) =>
        fn({ data: validate(args.data) }),
    }),
  }),
}));
vi.mock("@/lib/account/customer-account.server", () => ({
  currentAuthorizationHeader: () => "Bearer verified-session",
  resolveVerifiedCustomerIdentity: io.identity,
}));
vi.mock("@/lib/plan-access.server", () => ({
  readCookie: () => "cookie-token",
  resolvePlanAccess: io.plan,
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => "cookies" }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: io.from } }));
import { getAccountIdentity } from "../functions";

beforeEach(() => {
  vi.clearAllMocks();
  io.identity.mockResolvedValue(null);
  io.plan.mockResolvedValue(null);
  io.single.mockResolvedValue({ data: { email_normalized: "plan@example.com" }, error: null });
  io.eq.mockReturnValue({ single: io.single });
  io.from.mockReturnValue({ select: () => ({ eq: io.eq }) });
});
describe("account identity", () => {
  it("returns no identifying details for an unsigned browser", async () => {
    expect(await getAccountIdentity({ data: { token: null } })).toEqual({
      ok: true,
      accountEmail: null,
      planEmail: null,
    });
    expect(io.from).not.toHaveBeenCalled();
  });
  it("uses verified Auth identity without requiring active ownership or creating an account", async () => {
    io.identity.mockResolvedValue({ emailNormalized: "member@example.com" });
    expect(await getAccountIdentity({ data: { token: null } })).toEqual({
      ok: true,
      accountEmail: "member@example.com",
      planEmail: null,
    });
    expect(io.identity).toHaveBeenCalledWith("Bearer verified-session");
    expect(io.from).not.toHaveBeenCalled();
  });
  it("reveals a free-plan email only after server-verified plan access", async () => {
    io.plan.mockResolvedValue({ leadPlanId: "authorized-plan" });
    expect(await getAccountIdentity({ data: { token: "credential" } })).toEqual({
      ok: true,
      accountEmail: null,
      planEmail: "plan@example.com",
    });
    expect(io.plan).toHaveBeenCalledWith("credential", "cookies");
    expect(io.eq).toHaveBeenCalledWith("id", "authorized-plan");
  });
  it("reports both identities when an older free-plan credential belongs to another account", async () => {
    io.identity.mockResolvedValue({ emailNormalized: "member@example.com" });
    io.plan.mockResolvedValue({ leadPlanId: "authorized-plan" });
    expect(await getAccountIdentity({ data: { token: null } })).toEqual({
      ok: true,
      accountEmail: "member@example.com",
      planEmail: "plan@example.com",
    });
  });
  it("offers retry rather than claiming a failed lookup means logged out", async () => {
    io.identity.mockRejectedValue(Error("unavailable"));
    expect(await getAccountIdentity({ data: { token: null } })).toEqual({ ok: false });
  });
});
