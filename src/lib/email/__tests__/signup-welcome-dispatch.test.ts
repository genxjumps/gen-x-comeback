import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createFakeAdapter } from "@/lib/email/adapters.server";
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  gate: true,
  job: {
    job_id: "job-1",
    intake_id: "intake-1",
    idempotency_key: "welcome-1",
    claim_token: "claim-1",
    attempt_count: 1,
    first_provider_attempt_at: null as string | null,
    token_expires_at: null as string | null,
  },
}));
vi.mock("@/lib/signup-recovery.server", () => ({ signupRpc: state.rpc }));
vi.mock("@/lib/email/credentials.server", () => ({
  readEmailTokenSecret: () => "test-secret-long-enough-for-token-generation",
}));
vi.mock("@/lib/email/config.server", () => ({
  readEmailConfig: () => ({
    providerApiKey: "test",
    fromEmail: "test@example.test",
    fromName: "Todd",
    replyTo: "test@example.test",
  }),
  evaluateSendingGate: () => ({ enabled: state.gate }),
  resolveAppOrigin: () => "https://app.genxjumps.com",
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        update: () => q,
        limit: async () => ({ data: [{ email_original: "person@example.test" }], error: null }),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      };
      return q;
    },
  },
}));
import { dispatchSignupWelcome } from "@/lib/email/signup-welcome.server";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T12:00:00Z"));
  state.gate = true;
  state.job.attempt_count = 1;
  state.job.first_provider_attempt_at = null;
  state.rpc.mockReset();
  state.rpc.mockImplementation(async (name: string) =>
    name === "claim_signup_welcome_jobs"
      ? [{ ...state.job }]
      : name === "begin_signup_welcome_attempt"
        ? { outcome: "ok", submission_attempt_id: "attempt-1" }
        : true,
  );
});
afterEach(() => vi.useRealTimers());
describe("welcome dispatch", () => {
  it("does not claim or send while runtime prerequisites are missing", async () => {
    state.gate = false;
    const adapter = createFakeAdapter();
    expect((await dispatchSignupWelcome("invocation", 10, adapter)).claimed).toBe(0);
    expect(state.rpc).not.toHaveBeenCalled();
    expect(adapter.requests).toHaveLength(0);
  });
  it.each([
    "sending_disabled",
    "controlled_scope_blocked",
    "limit_reached",
    "suppression_blocked",
    "lost_lease",
  ])("never sends across the %s provider fence", async (outcome) => {
    state.rpc.mockImplementation(async (name: string) =>
      name === "claim_signup_welcome_jobs"
        ? [{ ...state.job }]
        : name === "begin_signup_welcome_attempt"
          ? { outcome }
          : true,
    );
    const adapter = createFakeAdapter();
    await dispatchSignupWelcome("invocation", 10, adapter);
    expect(adapter.requests).toHaveLength(0);
  });
  it("retries an ambiguous provider response with identical credential and payload", async () => {
    const adapter = createFakeAdapter({
      script: [
        { outcome: "ambiguous", errorCode: "timeout" },
        {
          outcome: "accepted",
          providerKey: "fake",
          providerMessageId: "message-1",
          acceptedAt: "2026-09-09T12:00:00Z",
        },
      ],
    });
    const first = await dispatchSignupWelcome("invocation", 10, adapter);
    expect(first.outcomes[0].outcome).toBe("retry_scheduled");
    state.job.attempt_count = 2;
    state.job.first_provider_attempt_at = "2026-09-09T12:00:00Z";
    vi.setSystemTime(new Date("2026-09-09T12:05:00Z"));
    const next = await dispatchSignupWelcome("invocation-2", 10, adapter);
    expect(next.outcomes[0].outcome).toBe("provider_accepted");
    expect(adapter.requests[1]).toEqual(adapter.requests[0]);
    expect(adapter.requests[0].html).toContain("/signup/return?token=");
    expect(state.rpc.mock.calls.some((c) => c[0] === "reconcile_signup_welcome_events")).toBe(true);
  });
  it("never resends after the deduplication horizon", async () => {
    state.job.attempt_count = 2;
    state.job.first_provider_attempt_at = "2026-09-08T12:00:00Z";
    const adapter = createFakeAdapter();
    const result = await dispatchSignupWelcome("invocation", 10, adapter);
    expect(result.outcomes[0].outcome).toBe("failed_permanent");
    expect(adapter.requests).toHaveLength(0);
  });
});
