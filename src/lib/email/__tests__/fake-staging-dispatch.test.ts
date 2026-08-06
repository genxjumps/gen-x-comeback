// Focused tests for the staging-only fake-provider dispatch capability.
// Deterministic: no network, no database, no real provider. Every Supabase and
// provider boundary is either mocked or replaced by the in-memory store.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeDispatch, readStagingLeadPlanId } from "@/lib/email/dispatch-auth";
import { readFakeStagingConfig } from "@/lib/email/staging-config.server";
import { evaluateSendingGate } from "@/lib/email/config.server";
import { dispatchPlanReadyJobs, type DispatchDeps } from "@/lib/email/dispatch";
import type { EmailJobRow } from "@/lib/email/types";
import { createMemoryStore, makeJob, makeLead } from "./memory-store";

const LEAD = "11111111-1111-4111-8111-111111111111";
const OTHER_LEAD = "22222222-2222-4222-8222-222222222222";
const PROD_SECRET = "production-dispatch-secret-0123456789";
const STAGING_SECRET = "staging-dispatch-secret-0123456789";
const TOKEN_SECRET = "token-secret-token-secret-token-secret";
const FIXED_NOW = new Date("2026-02-01T12:00:00.000Z");

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
  delete process.env["EMAIL_DISPATCH_SECRET"];
  delete process.env["EMAIL_FAKE_STAGING_ENABLED"];
  delete process.env["EMAIL_STAGING_DISPATCH_SECRET"];
}

function stagingReadyEnv() {
  process.env["APP_ORIGIN"] = "https://app.genxjumps.com";
  process.env["EMAIL_FROM_ADDRESS"] = "todd@notify.genxjumps.com";
  process.env["EMAIL_FROM_NAME"] = "Todd from Gen X Jumps";
  process.env["EMAIL_REPLY_TO"] = "todd@genxjumps.com";
  process.env["EMAIL_TOKEN_SECRET_V1"] = TOKEN_SECRET;
  // Deliberately absent: every production release-gate flag and credential.
  delete process.env["EMAIL_SENDING_ENABLED"];
  delete process.env["EMAIL_STAGING_ACCEPTANCE_PASSED"];
  delete process.env["EMAIL_PROVIDER_API_KEY"];
  delete process.env["RESEND_API_KEY"];
  delete process.env["EMAIL_WEBHOOK_SECRET"];
  delete process.env["EMAIL_SENDING_DOMAIN_VERIFIED"];
  delete process.env["EMAIL_CLICK_TRACKING_DISABLED"];
  delete process.env["EMAIL_ALERTS_ENABLED"];
}

beforeEach(() => {
  resetEnv();
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("staging dispatch authorization", () => {
  it("rejects the staging secret while the staging flag is false", () => {
    process.env["EMAIL_DISPATCH_SECRET"] = PROD_SECRET;
    process.env["EMAIL_STAGING_DISPATCH_SECRET"] = STAGING_SECRET;
    expect(readFakeStagingConfig().enabled).toBe(false);
    expect(authorizeDispatch(req(STAGING_SECRET))).toBeNull();
  });

  it("rejects a wrong or missing staging secret while staging is enabled", () => {
    process.env["EMAIL_FAKE_STAGING_ENABLED"] = "true";
    expect(authorizeDispatch(req(STAGING_SECRET))).toBeNull();

    process.env["EMAIL_STAGING_DISPATCH_SECRET"] = STAGING_SECRET;
    expect(authorizeDispatch(req("not-the-staging-secret"))).toBeNull();
    expect(authorizeDispatch(req())).toBeNull();
  });

  it("accepts the staging secret only with flag plus secret, as fake_staging", () => {
    process.env["EMAIL_FAKE_STAGING_ENABLED"] = "true";
    process.env["EMAIL_STAGING_DISPATCH_SECRET"] = STAGING_SECRET;
    expect(authorizeDispatch(req(STAGING_SECRET))).toBe("fake_staging");
  });

  it("keeps the production authorization path unchanged", () => {
    process.env["EMAIL_DISPATCH_SECRET"] = PROD_SECRET;
    expect(authorizeDispatch(req(PROD_SECRET))).toBe("production");
    expect(authorizeDispatch(req("wrong"))).toBeNull();
    expect(authorizeDispatch(req())).toBeNull();

    // Staging enablement never changes the production verdict.
    process.env["EMAIL_FAKE_STAGING_ENABLED"] = "true";
    process.env["EMAIL_STAGING_DISPATCH_SECRET"] = STAGING_SECRET;
    expect(authorizeDispatch(req(PROD_SECRET))).toBe("production");
  });

  it("does not weaken the production sending gate", () => {
    process.env["EMAIL_FAKE_STAGING_ENABLED"] = "true";
    process.env["EMAIL_STAGING_DISPATCH_SECRET"] = STAGING_SECRET;
    stagingReadyEnv();
    const gate = evaluateSendingGate();
    expect(gate.enabled).toBe(false);
    if (!gate.enabled) {
      expect(gate.missing).toEqual(
        expect.arrayContaining([
          "EMAIL_SENDING_ENABLED",
          "EMAIL_PROVIDER_API_KEY",
          "EMAIL_WEBHOOK_SECRET",
          "EMAIL_SENDING_DOMAIN_VERIFIED",
          "EMAIL_CLICK_TRACKING_DISABLED",
          "EMAIL_ALERTS_ENABLED",
          "EMAIL_STAGING_ACCEPTANCE_PASSED",
        ]),
      );
    }
  });
});

describe("staging body validation", () => {
  it("rejects a missing, malformed, or non-uuid lead_plan_id", async () => {
    expect(await readStagingLeadPlanId(req(STAGING_SECRET))).toBeNull();
    expect(await readStagingLeadPlanId(req(STAGING_SECRET, {}))).toBeNull();
    expect(await readStagingLeadPlanId(req(STAGING_SECRET, { lead_plan_id: "nope" }))).toBeNull();
    expect(await readStagingLeadPlanId(req(STAGING_SECRET, [LEAD]))).toBeNull();
    expect(await readStagingLeadPlanId(req(STAGING_SECRET, { lead_plan_id: LEAD }))).toBe(LEAD);
  });

  it("returns 400 and claims nothing for valid staging auth with a bad body", async () => {
    process.env["EMAIL_FAKE_STAGING_ENABLED"] = "true";
    process.env["EMAIL_STAGING_DISPATCH_SECRET"] = STAGING_SECRET;
    stagingReadyEnv();

    const claimJobs = vi.fn();
    vi.doMock("@/lib/email/store.server", () => ({
      createSupabaseEmailStore: async () => ({ claimJobs }),
    }));

    const mod = await import("@/routes/api/public/email/dispatch");
    const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
    const server = options["server"] as {
      handlers: Record<string, (ctx: { request: Request }) => Promise<Response>>;
    };
    const response = await server.handlers["POST"]!({ request: req(STAGING_SECRET, {}) });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload["mode"]).toBe("fake_staging");
    expect(payload["sending_enabled"]).toBe(false);
    expect(claimJobs).not.toHaveBeenCalled();
  });
});

describe("fake staging runtime", () => {
  it("always selects the fake adapter even when EMAIL_PROVIDER=resend", async () => {
    stagingReadyEnv();
    process.env["EMAIL_PROVIDER"] = "resend";
    process.env["EMAIL_PROVIDER_API_KEY"] = "re_should_never_be_used";

    const createResendAdapter = vi.fn(() => {
      throw new Error("resend adapter must never be constructed in fake staging");
    });
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("@/lib/email/adapters.server", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/email/adapters.server")>(
          "@/lib/email/adapters.server",
        );
      return { ...actual, createResendAdapter };
    });
    vi.doMock("@/lib/email/store.server", () => ({
      createSupabaseEmailStore: async () => ({ claimJobs: async () => [] }),
    }));

    const { buildFakeStagingDispatchDeps } = await import("@/lib/email/staging-runtime.server");
    const runtime = await buildFakeStagingDispatchDeps(LEAD);
    expect(runtime.enabled).toBe(true);
    if (runtime.enabled) expect(runtime.deps.adapter.key).toBe("fake");
    expect(createResendAdapter).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not require any production sending or release flag", async () => {
    stagingReadyEnv();
    vi.doMock("@/lib/email/store.server", () => ({
      createSupabaseEmailStore: async () => ({ claimJobs: async () => [] }),
    }));
    const { buildFakeStagingDispatchDeps } = await import("@/lib/email/staging-runtime.server");
    const runtime = await buildFakeStagingDispatchDeps(LEAD);
    expect(runtime.enabled).toBe(true);
  });

  it("fails closed when app/from/reply/token configuration is missing", async () => {
    stagingReadyEnv();
    delete process.env["APP_ORIGIN"];
    delete process.env["EMAIL_FROM_ADDRESS"];
    delete process.env["EMAIL_REPLY_TO"];
    delete process.env["EMAIL_TOKEN_SECRET_V1"];

    vi.doMock("@/lib/email/store.server", () => ({
      createSupabaseEmailStore: async () => {
        throw new Error("store must not be created when configuration is missing");
      },
    }));
    const { buildFakeStagingDispatchDeps } = await import("@/lib/email/staging-runtime.server");
    const runtime = await buildFakeStagingDispatchDeps(LEAD);
    expect(runtime.enabled).toBe(false);
    if (!runtime.enabled) {
      expect(runtime.missing).toEqual([
        "APP_ORIGIN",
        "EMAIL_FROM_ADDRESS",
        "EMAIL_REPLY_TO",
        "EMAIL_TOKEN_SECRET_V1",
      ]);
    }
  });
});

describe("scoped Supabase store", () => {
  function mockAdmin() {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
    return rpc;
  }

  it("production store still uses claim_email_jobs", async () => {
    const rpc = mockAdmin();
    const { createSupabaseEmailStore } = await import("@/lib/email/store.server");
    const store = await createSupabaseEmailStore();
    await store.claimJobs("plan_ready", 25, 120);
    expect(rpc).toHaveBeenCalledWith("claim_email_jobs", {
      p_job_type: "plan_ready",
      p_limit: 25,
      p_lease_seconds: 120,
    });
  });

  it("staging store uses claim_email_jobs_for_lead with the scoped lead", async () => {
    const rpc = mockAdmin();
    const { createSupabaseEmailStore } = await import("@/lib/email/store.server");
    const store = await createSupabaseEmailStore({ leadPlanScope: LEAD });
    await store.claimJobs("plan_ready", 25, 120);
    expect(rpc).toHaveBeenCalledWith("claim_email_jobs_for_lead", {
      p_job_type: "plan_ready",
      p_lead_plan_id: LEAD,
      p_limit: 25,
      p_lease_seconds: 120,
    });
  });

  it("scoped claim can never return another lead's job", async () => {
    const rpc = vi.fn(async () => ({
      data: [makeJob({ job_id: "other", lead_plan_id: OTHER_LEAD })],
      error: null,
    }));
    vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
    const { createSupabaseEmailStore } = await import("@/lib/email/store.server");
    const store = await createSupabaseEmailStore({ leadPlanScope: LEAD });
    expect(await store.claimJobs("plan_ready", 25, 120)).toEqual([]);
  });
});

describe("scoped fake dispatch outcome", () => {
  it("marks only the target synthetic job provider_accepted with a fake provider", async () => {
    const { createFakeAdapter } = await import("@/lib/email/adapters.server");
    const store = createMemoryStore(() => FIXED_NOW);
    store.leads.set(LEAD, makeLead({ id: LEAD, plan_version_id: "version-target" }));
    store.leads.set(OTHER_LEAD, makeLead({ id: OTHER_LEAD, plan_version_id: "version-other" }));
    store.jobs.set(
      "job-target",
      makeJob({
        job_id: "job-target",
        lead_plan_id: LEAD,
        plan_version_id: "version-target",
        idempotency_key: "plan_ready:version-target:v1",
      }),
    );
    store.jobs.set(
      "job-other",
      makeJob({
        job_id: "job-other",
        lead_plan_id: OTHER_LEAD,
        plan_version_id: "version-other",
        idempotency_key: "plan_ready:version-other:v1",
      }),
    );

    // Mirrors the database-side authoritative lead filter.
    const scoped = {
      ...store,
      claimJobs: async (jobType: string, limit: number, leaseSeconds: number) =>
        (await store.claimJobs(jobType, limit, leaseSeconds)).filter(
          (job: EmailJobRow) => job.lead_plan_id === LEAD,
        ),
    };

    const adapter = createFakeAdapter();
    const deps: DispatchDeps = {
      store: scoped,
      adapter,
      now: () => FIXED_NOW,
      appOrigin: "https://app.genxjumps.com",
      fromEmail: "todd@notify.genxjumps.com",
      fromName: "Todd from Gen X Jumps",
      replyTo: "todd@genxjumps.com",
      deriveCredential: (purpose, planVersionId) => `cred:${purpose}:${planVersionId}`,
      hash: async (raw) => `hash:${raw}`,
    };

    await dispatchPlanReadyJobs(deps, { limit: 25 });

    const target = store.jobs.get("job-target")!;
    expect(target.provider_key).toBe("fake");
    expect(target.provider_message_id).toMatch(/^fake-/);
    expect(target.provider_accepted_at).toBeTruthy();

    const other = store.jobs.get("job-other")!;
    expect(other.provider_key).toBeNull();
    expect(other.provider_accepted_at ?? null).toBeNull();
    expect(other.status).toBe("pending");
    expect(adapter.requests).toHaveLength(1);
  });
});

describe("staging dispatch response", () => {
  it("reports mode=fake_staging, sending_enabled false, and no global stale sweep", async () => {
    process.env["EMAIL_FAKE_STAGING_ENABLED"] = "true";
    process.env["EMAIL_STAGING_DISPATCH_SECRET"] = STAGING_SECRET;
    stagingReadyEnv();
    process.env["EMAIL_PROVIDER"] = "resend";

    const raiseStaleAlerts = vi.fn(async () => 7);
    vi.doMock("@/lib/email/store.server", () => ({
      createSupabaseEmailStore: async () => ({
        claimJobs: async () => [],
        raiseStaleAlerts,
      }),
    }));
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);

    const mod = await import("@/routes/api/public/email/dispatch");
    const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
    const server = options["server"] as {
      handlers: Record<string, (ctx: { request: Request }) => Promise<Response>>;
    };
    const response = await server.handlers["POST"]!({
      request: req(STAGING_SECRET, { lead_plan_id: LEAD }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload["mode"]).toBe("fake_staging");
    expect(payload["sending_enabled"]).toBe(false);
    expect(payload["stale_alerts"]).toBe(0);
    expect(payload["lead_plan_id"]).toBe(LEAD);
    // The global, non-lead-scoped sweep never runs in staging.
    expect(raiseStaleAlerts).not.toHaveBeenCalled();
    // No provider network call of any kind.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
