// Focused tests for the controlled real-provider staging dispatch capability.
// Deterministic: no network, no database, no real provider send. Every Supabase
// and provider boundary is mocked; the Resend HTTP call is never performed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeDispatch, readStagingLeadPlanId } from "@/lib/email/dispatch-auth";
import { evaluateSendingGate } from "@/lib/email/config.server";
import { makeJob, makeLead } from "./memory-store";

const LEAD = "33333333-3333-4333-8333-333333333333";
const OTHER_LEAD = "44444444-4444-4444-8444-444444444444";
const PROD_SECRET = "production-dispatch-secret-0123456789";
const FAKE_SECRET = "fake-staging-dispatch-secret-0123456789";
const REAL_SECRET = "real-staging-dispatch-secret-0123456789";
const TOKEN_SECRET = "token-secret-token-secret-token-secret";
const ALLOWED = "todd+staging@genxjumps.com";
const NOT_ALLOWED = "someone.else@example.com";

function req(secret?: string, body?: unknown): Request {
  return new Request("https://app.genxjumps.com/api/public/email/dispatch", {
    method: "POST",
    ...(secret ? { headers: { authorization: `Bearer ${secret}` } } : {}),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  for (const name of [
    "EMAIL_DISPATCH_SECRET",
    "EMAIL_FAKE_STAGING_ENABLED",
    "EMAIL_STAGING_DISPATCH_SECRET",
    "EMAIL_REAL_STAGING_ENABLED",
    "EMAIL_REAL_STAGING_DISPATCH_SECRET",
    "EMAIL_REAL_STAGING_ALLOWED_RECIPIENT",
  ]) {
    delete process.env[name];
  }
}

/** Everything real staging legitimately needs, and none of the production gates. */
function realStagingReadyEnv() {
  process.env["EMAIL_REAL_STAGING_ENABLED"] = "true";
  process.env["EMAIL_REAL_STAGING_DISPATCH_SECRET"] = REAL_SECRET;
  process.env["EMAIL_REAL_STAGING_ALLOWED_RECIPIENT"] = ALLOWED;
  process.env["APP_ORIGIN"] = "https://app.genxjumps.com";
  process.env["EMAIL_PROVIDER"] = "resend";
  process.env["EMAIL_PROVIDER_API_KEY"] = "re_staging_key";
  process.env["EMAIL_FROM_ADDRESS"] = "todd@notify.genxjumps.com";
  process.env["EMAIL_FROM_NAME"] = "Todd from Gen X Jumps";
  process.env["EMAIL_REPLY_TO"] = "todd@genxjumps.com";
  process.env["EMAIL_WEBHOOK_SECRET"] = "whsec_staging";
  process.env["EMAIL_TOKEN_SECRET_V1"] = TOKEN_SECRET;
  // Deliberately absent: the production release-gate flags.
  delete process.env["EMAIL_SENDING_ENABLED"];
  delete process.env["EMAIL_STAGING_ACCEPTANCE_PASSED"];
  delete process.env["EMAIL_SENDING_DOMAIN_VERIFIED"];
  delete process.env["EMAIL_CLICK_TRACKING_DISABLED"];
  delete process.env["EMAIL_ALERTS_ENABLED"];
}

/** Mocks supabaseAdmin so both the scoped claim RPC and lead read are observable. */
function mockAdmin(leadEmail: string | null, jobs: ReturnType<typeof makeJob>[] = []) {
  const rpc = vi.fn(async (fn: string) => {
    if (fn === "claim_email_jobs_for_lead") return { data: jobs, error: null };
    return { data: [], error: null };
  });
  const from = vi.fn((table: string) => {
    const rows =
      table === "lead_plans" && leadEmail
        ? [makeLead({ id: LEAD, email_normalized: leadEmail, email_original: leadEmail })]
        : [];
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "order", "update", "insert", "upsert"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder["limit"] = vi.fn(async () => ({ data: rows, error: null }));
    return builder;
  });
  vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc, from } }));
  return { rpc, from };
}

async function routeHandler() {
  const mod = await import("@/routes/api/public/email/dispatch");
  const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
  const server = options["server"] as {
    handlers: Record<string, (ctx: { request: Request }) => Promise<Response>>;
  };
  return server.handlers["POST"]!;
}

beforeEach(() => {
  resetEnv();
  vi.resetModules();
  vi.doUnmock("@/lib/email/store.server");
  vi.doUnmock("@/lib/email/adapters.server");
  vi.doUnmock("@/integrations/supabase/client.server");
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("real staging authorization", () => {
  it("rejects the real-staging secret while the real-staging flag is false", () => {
    process.env["EMAIL_REAL_STAGING_DISPATCH_SECRET"] = REAL_SECRET;
    expect(authorizeDispatch(req(REAL_SECRET))).toBeNull();
  });

  it("rejects a wrong or missing real-staging secret while the flag is true", () => {
    process.env["EMAIL_REAL_STAGING_ENABLED"] = "true";
    expect(authorizeDispatch(req(REAL_SECRET))).toBeNull();

    process.env["EMAIL_REAL_STAGING_DISPATCH_SECRET"] = REAL_SECRET;
    expect(authorizeDispatch(req("not-the-real-secret"))).toBeNull();
    expect(authorizeDispatch(req())).toBeNull();
    expect(authorizeDispatch(req(REAL_SECRET))).toBe("real_staging");
  });

  it("keeps production authorization unchanged and distinct from both staging modes", () => {
    process.env["EMAIL_DISPATCH_SECRET"] = PROD_SECRET;
    process.env["EMAIL_REAL_STAGING_ENABLED"] = "true";
    process.env["EMAIL_REAL_STAGING_DISPATCH_SECRET"] = REAL_SECRET;
    process.env["EMAIL_FAKE_STAGING_ENABLED"] = "true";
    process.env["EMAIL_STAGING_DISPATCH_SECRET"] = FAKE_SECRET;

    expect(authorizeDispatch(req(PROD_SECRET))).toBe("production");
    expect(authorizeDispatch(req(REAL_SECRET))).toBe("real_staging");
    expect(authorizeDispatch(req(FAKE_SECRET))).toBe("fake_staging");
    expect(authorizeDispatch(req("wrong"))).toBeNull();
  });

  it("does not weaken the production sending gate", () => {
    realStagingReadyEnv();
    const gate = evaluateSendingGate();
    expect(gate.enabled).toBe(false);
    if (!gate.enabled) {
      expect(gate.missing).toEqual(
        expect.arrayContaining([
          "EMAIL_SENDING_ENABLED",
          "EMAIL_SENDING_DOMAIN_VERIFIED",
          "EMAIL_CLICK_TRACKING_DISABLED",
          "EMAIL_ALERTS_ENABLED",
          "EMAIL_STAGING_ACCEPTANCE_PASSED",
        ]),
      );
    }
  });
});

describe("real staging request scope", () => {
  it("rejects a missing or invalid lead_plan_id before any claim", async () => {
    realStagingReadyEnv();
    expect(await readStagingLeadPlanId(req(REAL_SECRET))).toBeNull();
    expect(await readStagingLeadPlanId(req(REAL_SECRET, { lead_plan_id: "nope" }))).toBeNull();

    const claimJobs = vi.fn();
    vi.doMock("@/lib/email/store.server", () => ({
      createSupabaseEmailStore: async () => ({ claimJobs }),
    }));
    const handler = await routeHandler();
    const response = await handler({ request: req(REAL_SECRET, {}) });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload["mode"]).toBe("real_staging");
    expect(payload["sending_enabled"]).toBe(false);
    expect(payload["error"]).toBe("invalid_lead_plan_id");
    expect(claimJobs).not.toHaveBeenCalled();
  });

  it("rejects a lead whose authoritative email is not the allowlisted recipient", async () => {
    realStagingReadyEnv();
    const { rpc } = mockAdmin(NOT_ALLOWED);
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);

    const handler = await routeHandler();
    const response = await handler({ request: req(REAL_SECRET, { lead_plan_id: LEAD }) });

    expect(response.status).toBe(403);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload["error"]).toBe("recipient_not_allowed");
    expect(payload["claimed"]).toBe(0);
    // No claim RPC and no provider request ever happened.
    expect(rpc).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("request parameters cannot redirect the send to an arbitrary email", async () => {
    realStagingReadyEnv();
    const { rpc } = mockAdmin(NOT_ALLOWED);
    const handler = await routeHandler();
    const response = await handler({
      request: req(REAL_SECRET, {
        lead_plan_id: LEAD,
        // All of these are ignored: server config is authoritative.
        to: NOT_ALLOWED,
        allowed_recipient: NOT_ALLOWED,
        from: "attacker@example.com",
        reply_to: "attacker@example.com",
        provider: "fake",
        real_staging_enabled: true,
      }),
    });

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses only the lead-scoped claim RPC, never the broad claim_email_jobs", async () => {
    realStagingReadyEnv();
    const { rpc } = mockAdmin(ALLOWED);
    const handler = await routeHandler();
    const response = await handler({ request: req(REAL_SECRET, { lead_plan_id: LEAD }) });

    expect(response.status).toBe(200);
    const called = rpc.mock.calls.map((call) => call[0]);
    expect(called.length).toBeGreaterThan(0);
    expect(new Set(called)).toEqual(new Set(["claim_email_jobs_for_lead"]));
    expect(called).not.toContain("claim_email_jobs");
    for (const call of rpc.mock.calls) {
      expect((call[1] as { p_lead_plan_id: string }).p_lead_plan_id).toBe(LEAD);
    }
  });

  it("never returns another lead's job from the scoped claim", async () => {
    realStagingReadyEnv();
    mockAdmin(ALLOWED, [makeJob({ job_id: "foreign", lead_plan_id: OTHER_LEAD })]);
    const { createSupabaseEmailStore } = await import("@/lib/email/store.server");
    const store = await createSupabaseEmailStore({ leadPlanScope: LEAD });
    expect(await store.claimJobs("plan_ready", 25, 120)).toEqual([]);
  });
});

describe("real staging runtime", () => {
  it("uses the Resend adapter, fixed by server config", async () => {
    realStagingReadyEnv();
    process.env["EMAIL_PROVIDER"] = "fake";
    mockAdmin(ALLOWED);

    const { buildRealStagingDispatchDeps } = await import(
      "@/lib/email/real-staging-runtime.server"
    );
    const runtime = await buildRealStagingDispatchDeps(LEAD);
    expect(runtime.ok).toBe(true);
    if (runtime.ok) expect(runtime.deps.adapter.key).toBe("resend");
  });

  it("fake staging still uses the fake adapter", async () => {
    realStagingReadyEnv();
    mockAdmin(ALLOWED);
    const { buildFakeStagingDispatchDeps } = await import("@/lib/email/staging-runtime.server");
    const runtime = await buildFakeStagingDispatchDeps(LEAD);
    expect(runtime.enabled).toBe(true);
    if (runtime.enabled) expect(runtime.deps.adapter.key).toBe("fake");
  });

  it("does not require EMAIL_SENDING_ENABLED or EMAIL_STAGING_ACCEPTANCE_PASSED", async () => {
    realStagingReadyEnv();
    mockAdmin(ALLOWED);
    expect(process.env["EMAIL_SENDING_ENABLED"]).toBeUndefined();
    expect(process.env["EMAIL_STAGING_ACCEPTANCE_PASSED"]).toBeUndefined();

    const { buildRealStagingDispatchDeps } = await import(
      "@/lib/email/real-staging-runtime.server"
    );
    const runtime = await buildRealStagingDispatchDeps(LEAD);
    expect(runtime.ok).toBe(true);
  });

  it("fails closed when required provider, link, or webhook configuration is missing", async () => {
    realStagingReadyEnv();
    delete process.env["EMAIL_PROVIDER_API_KEY"];
    delete process.env["EMAIL_WEBHOOK_SECRET"];
    delete process.env["EMAIL_TOKEN_SECRET_V1"];
    delete process.env["EMAIL_REAL_STAGING_ALLOWED_RECIPIENT"];

    vi.doMock("@/lib/email/store.server", () => ({
      createSupabaseEmailStore: async () => {
        throw new Error("store must not be created when configuration is missing");
      },
    }));
    const { buildRealStagingDispatchDeps } = await import(
      "@/lib/email/real-staging-runtime.server"
    );
    const runtime = await buildRealStagingDispatchDeps(LEAD);
    expect(runtime.ok).toBe(false);
    if (!runtime.ok && runtime.error === "missing_configuration") {
      expect(runtime.missing).toEqual([
        "EMAIL_REAL_STAGING_ALLOWED_RECIPIENT",
        "EMAIL_PROVIDER_API_KEY",
        "EMAIL_TOKEN_SECRET_V1",
        "EMAIL_WEBHOOK_SECRET",
      ]);
    }
  });
});

describe("real staging response and ordering", () => {
  it("reports non-secret evidence, sending_enabled false, and no global stale sweep", async () => {
    realStagingReadyEnv();
    const { rpc } = mockAdmin(ALLOWED);
    const handler = await routeHandler();
    const response = await handler({ request: req(REAL_SECRET, { lead_plan_id: LEAD }) });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload["mode"]).toBe("real_staging");
    expect(payload["sending_enabled"]).toBe(false);
    expect(payload["lead_plan_id"]).toBe(LEAD);
    expect(payload["claimed"]).toBe(0);
    expect(payload["outcomes"]).toEqual([]);
    expect(payload["provider_key"]).toBeNull();
    expect(payload["provider_message_id"]).toBeNull();
    expect(payload["stale_alerts"]).toBe(0);
    // The global, non-lead-scoped sweep never runs in staging.
    expect(rpc.mock.calls.map((call) => call[0])).not.toContain("raise_stale_email_job_alerts");

    // No secret material of any kind is echoed back.
    const serialized = JSON.stringify(payload);
    for (const secret of [REAL_SECRET, TOKEN_SECRET, "re_staging_key", "whsec_staging"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("keeps lifecycle dispatch ordering identical to production", async () => {
    const order: string[] = [];
    const summary = { claimed: 0, outcomes: [] };
    vi.doMock("@/lib/email/dispatch", () => ({
      dispatchPlanReadyJobs: async () => (order.push("plan_ready"), summary),
      dispatchRecoveryJobs: async () => (order.push("recovery"), summary),
      dispatchPlanCompletedJobs: async () => (order.push("plan_completed"), summary),
      dispatchHalfwayJobs: async () => (order.push("halfway"), summary),
      dispatchFinalRescueJobs: async () => (order.push("final_rescue"), summary),
      dispatchStalledJobs: async () => (order.push("stalled"), summary),
      dispatchStartDayOneJobs: async () => (order.push("start_day_1"), summary),
      raiseStalePlanReadyAlerts: async () => (order.push("stale_alerts"), 0),
    }));

    const { runDispatchCycle } = await import("@/lib/email/dispatch-cycle.server");
    await runDispatchCycle({} as never, { limit: 25 });

    expect(order).toEqual([
      "plan_ready",
      "recovery",
      "plan_completed",
      "halfway",
      "final_rescue",
      "stalled",
      "start_day_1",
    ]);
  });
});
