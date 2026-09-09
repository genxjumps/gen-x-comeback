import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  signupRpc: vi.fn(),
  cookie: vi.fn(),
  intake: vi.fn(),
  calendar: vi.fn(),
}));

// Exercise the production handlers, replacing only framework and I/O boundaries.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (handler: unknown) => handler }),
  }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: mocks.rpc },
}));
vi.mock("@/lib/intake", () => ({ NEW_PLAN_INTAKE_OPEN: true }));
vi.mock("@/lib/plan-access.server", () => ({ currentCookieHeader: async () => "cookie" }));
vi.mock("@/lib/signup-recovery.server", () => ({
  signupRpc: mocks.signupRpc,
  signupCookieHash: async () => "hash",
  readSignupIntake: mocks.intake,
  issueSignupPlanCookie: mocks.cookie,
}));
vi.mock("@/lib/lead-plan-calendar.server", () => ({
  configureLeadPlanCalendar: mocks.calendar,
}));
vi.mock("@/lib/lead-plan", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  planFromAnswers: () => ({ plan: {}, snapshot: {} }),
}));

import { saveLeadPlan, saveLeadPlanFromHandoff } from "@/lib/lead.functions";

const input = {
  submissionId: "test-submission",
  sessionTokenHash: "hash",
  assessment: {},
  timeZone: "UTC",
  email: "fixture@example.com",
  firstName: "Fixture",
};
const handoff = saveLeadPlanFromHandoff as unknown as (arg: {
  data: typeof input;
}) => Promise<unknown>;
const direct = saveLeadPlan as unknown as (arg: { data: typeof input }) => Promise<unknown>;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.intake.mockResolvedValue({ intake_id: "intake" });
  mocks.signupRpc.mockResolvedValue({ outcome: "saved", leadPlanId: "plan", replayed: false });
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "commit_plan_version"
      ? {
          data: [{ outcome: "new", lead_plan_id: "plan", first_name: "Fixture", replayed: false }],
          error: null,
        }
      : { data: "invocation", error: null },
  );
});

describe("immediate Plan Ready dispatch", () => {
  it("wakes after the atomic handoff save and before session issuance", async () => {
    await expect(handoff({ data: input })).resolves.toEqual({ outcome: "saved", replayed: false });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("invoke_email_dispatch_scheduler");
    expect(mocks.signupRpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.rpc.mock.invocationCallOrder[0]!,
    );
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cookie.mock.invocationCallOrder[0]!,
    );
  });

  it.each(["resume", "expired"])("does not wake for %s", async (outcome) => {
    mocks.signupRpc.mockResolvedValue({ outcome });
    await handoff({ data: input });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not wake after a failed save", async () => {
    mocks.signupRpc.mockRejectedValue(new Error("save failed"));
    await expect(handoff({ data: input })).rejects.toThrow("save failed");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["transport", "rpc"])(
    "preserves saved access when the wake fails through %s",
    async (failure) => {
      if (failure === "transport") mocks.rpc.mockRejectedValue(new Error("network"));
      else mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
      await expect(handoff({ data: input })).resolves.toEqual({
        outcome: "saved",
        replayed: false,
      });
      expect(mocks.cookie).toHaveBeenCalledWith("plan");
    },
  );

  it("wakes on an exact save replay so the durable job can retry", async () => {
    mocks.signupRpc.mockResolvedValue({ outcome: "saved", leadPlanId: "plan", replayed: true });
    await expect(handoff({ data: input })).resolves.toEqual({ outcome: "saved", replayed: true });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("invoke_email_dispatch_scheduler");
  });

  it("wakes direct signup only after commit and calendar configuration", async () => {
    await direct({ data: input });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "commit_plan_version",
      "invoke_email_dispatch_scheduler",
    ]);
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.calendar.mock.invocationCallOrder[0]!,
    );
    expect(mocks.calendar.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.rpc.mock.invocationCallOrder[1]!,
    );
  });

  it("does not wake if direct signup calendar configuration fails", async () => {
    mocks.calendar.mockRejectedValue(new Error("calendar failed"));
    await expect(direct({ data: input })).rejects.toThrow("calendar failed");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
