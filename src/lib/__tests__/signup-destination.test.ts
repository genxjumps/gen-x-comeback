import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_INTAKE_COOKIE } from "@/lib/lead-intake-handoff";
const state = vi.hoisted(() => ({
  exists: false,
  verified: false,
  access: null as { leadPlanId: string } | null,
  cookies: vi.fn(),
  rpc: vi.fn(),
  bridge: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => ({ setCookie: state.cookies }));
vi.mock("@/lib/email/credentials.server", () => ({
  readEmailTokenSecret: () => "test-secret-32-characters-long-enough",
}));
vi.mock("@/lib/plan-access.server", async () => ({
  ...(await vi.importActual<typeof import("@/lib/plan-access.server")>("@/lib/plan-access.server")),
  resolvePlanAccess: async () => state.access,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: state.rpc,
    auth: { admin: { generateLink: state.bridge } },
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        limit: async () => ({ data: state.exists ? [{ id: "saved-plan" }] : [], error: null }),
      };
      return q;
    },
  },
}));
import { resolveSignupDestination } from "@/lib/signup-recovery.server";
const cookie = `${LEAD_INTAKE_COOKIE}=${"a".repeat(43)}`;
beforeEach(() => {
  state.exists = false;
  state.verified = false;
  state.access = null;
  state.cookies.mockReset();
  state.rpc.mockReset();
  state.bridge.mockReset();
  state.bridge.mockResolvedValue({
    data: { properties: { hashed_token: "member-bridge" } },
    error: null,
  });
  state.rpc.mockImplementation(async (name: string) => ({
    error: null,
    data:
      name === "resolve_signup_intake"
        ? [
            {
              intake_id: "intake-1",
              email_normalized: "person@example.test",
              first_name: "Person",
              completed_lead_plan_id: null,
            },
          ]
        : state.verified,
  }));
});
describe("welcome destination uses current trusted state", () => {
  it("returns setup without creating an identity or access session before a plan exists", async () => {
    const result = await resolveSignupDestination(cookie);
    expect(result).toMatchObject({ ok: true, state: "setup", firstName: "Person" });
    if (result.ok && result.state === "setup") expect(result.draftKey).toMatch(/^[a-f0-9]{64}$/);
    expect(state.cookies).not.toHaveBeenCalled();
    expect(state.bridge).not.toHaveBeenCalled();
  });
  it("never grants an existing plan to an unverified signup cookie", async () => {
    state.exists = true;
    expect(await resolveSignupDestination(cookie)).toEqual({ ok: true, state: "check_email" });
    expect(state.cookies).not.toHaveBeenCalled();
    expect(state.bridge).not.toHaveBeenCalled();
  });
  it("requires the matching participant when another plan is recognized", async () => {
    state.exists = true;
    state.access = { leadPlanId: "someone-else" };
    expect(await resolveSignupDestination(cookie, "other-token")).toEqual({
      ok: true,
      state: "check_email",
    });
  });
  it("opens a matching authorized plan without sending or replacing anything", async () => {
    state.exists = true;
    state.access = { leadPlanId: "saved-plan" };
    expect(await resolveSignupDestination(cookie)).toEqual({ ok: true, state: "plan" });
    expect(state.rpc.mock.calls.map((c) => c[0])).toEqual(["resolve_signup_intake"]);
  });
  it("an older welcome link follows a plan saved since opt-in", async () => {
    expect(await resolveSignupDestination(cookie)).toMatchObject({ state: "setup" });
    state.exists = true;
    state.verified = true;
    expect(await resolveSignupDestination(cookie)).toEqual({
      ok: true,
      state: "plan",
      useCookie: true,
      platformAuthTokenHash: "member-bridge",
    });
    expect(state.cookies).toHaveBeenCalledOnce();
    expect(state.rpc.mock.calls.some((c) => /commit|restart/.test(c[0]))).toBe(false);
  });
  it("keeps secure free-plan access if the member-session bridge fails", async () => {
    state.exists = true;
    state.verified = true;
    state.bridge.mockRejectedValue(new Error("bridge unavailable"));
    expect(await resolveSignupDestination(cookie)).toMatchObject({
      state: "plan",
      platformAuthTokenHash: null,
    });
  });
  it("missing or expired handoffs return a recoverable state", async () => {
    expect(await resolveSignupDestination(null)).toEqual({
      ok: false,
      reason: "missing_or_expired",
    });
    state.rpc.mockResolvedValue({ data: [], error: null });
    expect(await resolveSignupDestination(cookie)).toEqual({
      ok: false,
      reason: "missing_or_expired",
    });
  });
});
