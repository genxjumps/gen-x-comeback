// Production-path consent contracts.
//
// These cases exercise the real production route handlers and the real
// service-role RPC boundary. No test-only consent model is used: the assertions
// are about what production code actually invokes and what the applied
// migrations actually contain. No provider is used and no email is ever sent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const SECRET = "consent-contract-token-secret-0123456789";

const NEW_PLAN_VERSION_MIGRATION =
  "supabase/migrations/20260807180632_72978a70-fadf-41c5-be5f-4977c645896a.sql";
const PROVIDER_FENCE_MIGRATION =
  "supabase/migrations/20260807180709_d9ff7846-f2b9-4587-9326-9a5e142a2056.sql";
const CONSENT_MIGRATION =
  "supabase/migrations/20260807175301_630a998c-8645-4bfa-9f21-e0c0166d673e.sql";

// ---------------------------------------------------------------------------
// Service-role client double.
//
// Receiver-sensitive, exactly like the SDK: a detached `rpc` reference throws
// before any request is made, so a regression is detectable here. Every RPC and
// every table write performed by production code is recorded.
// ---------------------------------------------------------------------------

type RpcCall = { fn: string; args: Record<string, unknown> };

const rpcCalls: RpcCall[] = [];
const tableWrites: Array<{ table: string; op: string; payload?: unknown }> = [];
const rateLimitCalls: string[] = [];
let rateLimitAllowed = true;
let credentialLeadPlanId: string | null = "lead-1";
let planConsentActive = true;

vi.mock("@/lib/email/rate-limit.server", () => ({
  callerBucketKey: (scope: string) => `${scope}:hashed-caller`,
  consumeRateLimit: async (bucket: string) => {
    rateLimitCalls.push(bucket);
    return { allowed: rateLimitAllowed };
  },
}));

vi.mock("@/integrations/supabase/client.server", () => {
  function selectResult(table: string) {
    if (table === "email_preference_credentials") {
      return credentialLeadPlanId
        ? { data: [{ lead_plan_id: credentialLeadPlanId }], error: null }
        : { data: [], error: null };
    }
    if (table === "lead_plans") {
      return { data: [{ plan_email_consent_active: planConsentActive }], error: null };
    }
    return { data: [], error: null };
  }

  function builder(table: string) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      limit: () => Promise.resolve(selectResult(table)),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(selectResult(table)).then(resolve),
      update: (payload: unknown) => {
        tableWrites.push({ table, op: "update", payload });
        return chain;
      },
      insert: (payload: unknown) => {
        tableWrites.push({ table, op: "insert", payload });
        return chain;
      },
    };
    return chain;
  }

  const client = {
    rest: { marker: "service-role" },
    from(this: unknown, table: string) {
      const self = this as { rest?: { marker?: string } } | undefined;
      if (!self || self.rest?.marker !== "service-role") {
        throw new TypeError("detached from()");
      }
      return builder(table);
    },
    rpc(this: unknown, fn: string, args: Record<string, unknown>) {
      const self = this as { rest?: { marker?: string } } | undefined;
      if (!self || self.rest?.marker !== "service-role") {
        throw new TypeError("undefined is not an object (evaluating 'this.rest')");
      }
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { supabaseAdmin: client };
});

type Handler = (ctx: { request: Request }) => Promise<Response>;

async function routeHandler(path: string, method: "GET" | "POST"): Promise<Handler> {
  const mod = (await import(path)) as { Route: { options: Record<string, unknown> } };
  const server = mod.Route.options["server"] as { handlers: Record<string, Handler> };
  const handler = server.handlers[method];
  if (!handler) throw new Error(`missing ${method} handler for ${path}`);
  return handler;
}

async function recoverRequestId(): Promise<string> {
  const handler = await routeHandler("@/routes/recover", "GET");
  const html = await (
    await handler({ request: new Request("https://app.genxjumps.com/recover") })
  ).text();
  const match = /name="request_id" value="([^"]*)"/.exec(html);
  if (!match) throw new Error("no request id in form");
  return match[1]!;
}

describe("Recovery production RPC contract", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env["EMAIL_TOKEN_SECRET_V1"] = SECRET;
    rpcCalls.length = 0;
    tableWrites.length = 0;
    rateLimitCalls.length = 0;
    rateLimitAllowed = true;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("routes a real Recovery request through the single authoritative consent RPC", async () => {
    const handler = await routeHandler("@/routes/recover", "POST");
    const body = new FormData();
    body.set("email", "  Reader@Example.COM ");
    body.set("request_id", await recoverRequestId());

    const response = await handler({
      request: new Request("https://app.genxjumps.com/recover", { method: "POST", body }),
    });
    expect(response.status).toBe(200);

    // Exactly one production RPC, with the one normalized identity.
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]!.fn).toBe("request_plan_recovery");
    expect(rpcCalls[0]!.args["p_email_normalized"]).toBe("reader@example.com");

    // The route itself never writes consent columns: the RPC is authoritative.
    expect(tableWrites).toHaveLength(0);
  });

  it("proves the inactive-to-active Recovery RPC writes plan_recovery only and cancels pre-boundary proactive jobs", () => {
    // The applied plpgsql cannot execute in this harness, so the authoritative
    // production function body is asserted directly.
    const sql = readFileSync(CONSENT_MIGRATION, "utf8");
    const recovery = sql.slice(sql.indexOf("FUNCTION public.request_plan_recovery"));
    const body = recovery.slice(0, recovery.indexOf("-- 9."));

    // Inactive-to-active only, with the Recovery source.
    expect(body).toContain("IF NOT v_lead.plan_email_consent_active THEN");
    expect(body).toContain("set_plan_email_consent(v_lead.id, true, 'plan_recovery')");
    // Marketing consent is never read or written by Recovery.
    expect(body).not.toContain("marketing_consent");
    // Recovery still queues the transactional job it was asked for.
    expect(body).toContain("'recovery', 'v1', 'recovery_v1'");

    const setConsent = sql.slice(sql.indexOf("FUNCTION public.set_plan_email_consent"));
    const transition = setConsent.slice(0, setConsent.indexOf("-- 8."));
    // Fresh Plan timestamp, cleared unsubscribe, pre-boundary proactive closure.
    expect(transition).toContain("plan_email_consent_at = v_now");
    expect(transition).toContain("plan_email_unsubscribed_at = NULL");
    expect(transition).toContain("cancel_unsent_proactive_jobs(p_lead_plan_id, v_now)");
    // Already-active consent is a no-op: no refresh, no cancel, no restart.
    expect(transition).toContain("IF v_active THEN RETURN false; END IF;");
  });

  it("proves the shared cancellation closes proactive types only and never Recovery", () => {
    const sql = readFileSync(CONSENT_MIGRATION, "utf8");
    const fn = sql.slice(sql.indexOf("FUNCTION public.cancel_unsent_proactive_jobs"));
    const body = fn.slice(0, fn.indexOf("-- 7."));
    expect(body).toContain(
      "job_type IN ('plan_ready','start_day_1','halfway','stalled','final_rescue','plan_completed')",
    );
    expect(body).toContain("provider_accepted_at IS NULL");
    expect(body).toContain("status IN ('pending','processing','retry_scheduled')");
    expect(body).not.toContain("'recovery'");
  });
});

describe("Plan preferences production POST contract", () => {
  const original = { ...process.env };
  // A real 43-character opaque credential shape.
  const CREDENTIAL = "a".repeat(43);

  beforeEach(() => {
    process.env["EMAIL_TOKEN_SECRET_V1"] = SECRET;
    rpcCalls.length = 0;
    tableWrites.length = 0;
    rateLimitAllowed = true;
    credentialLeadPlanId = "lead-1";
    planConsentActive = true;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  async function submit(action: string): Promise<Response> {
    const handler = await routeHandler("@/routes/email-preferences", "POST");
    const body = new FormData();
    body.set("c", CREDENTIAL);
    body.set("action", action);
    return handler({
      request: new Request("https://app.genxjumps.com/email-preferences", {
        method: "POST",
        body,
      }),
    });
  }

  it("invokes the Plan-only consent RPC on unsubscribe and never touches marketing", async () => {
    const response = await submit("unsubscribe");
    expect(response.status).toBe(200);

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]!.fn).toBe("set_plan_email_consent");
    expect(rpcCalls[0]!.args).toEqual({
      p_lead_plan_id: "lead-1",
      p_active: false,
      p_source: "plan_preferences",
    });
    // No direct consent write, and nothing marketing-related, from this route.
    expect(tableWrites).toHaveLength(0);
    const source = readFileSync("src/routes/email-preferences.ts", "utf8");
    expect(source).not.toContain("marketing_consent");
  });

  it("invokes the same Plan-only RPC on resubscribe", async () => {
    await submit("resubscribe");
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]!.args["p_active"]).toBe(true);
    expect(rpcCalls[0]!.args["p_source"]).toBe("plan_preferences");
  });

  it("never reaches the consent RPC without a resolvable credential", async () => {
    credentialLeadPlanId = null;
    const response = await submit("unsubscribe");
    expect(response.status).toBe(200);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("new-Plan-start consent boundary migration contract", () => {
  it("activates both consents when an existing normalized identity commits a new Plan version", () => {
    const sql = readFileSync(NEW_PLAN_VERSION_MIGRATION, "utf8");

    // Bound to the authoritative plan-commit write that publishes a NEW plan
    // version, on the one existing row: no arbitrary update reactivates consent.
    expect(sql).toContain("BEFORE UPDATE ON public.lead_plans");
    expect(sql).toContain("NEW.plan_version_id IS DISTINCT FROM OLD.plan_version_id");

    // Both consents active, both sources plan_signup, both timestamps fresh,
    // both unsubscribe timestamps cleared.
    for (const line of [
      "NEW.plan_email_consent_active := true;",
      "NEW.plan_email_consent_source := 'plan_signup';",
      "NEW.plan_email_consent_at := now();",
      "NEW.plan_email_unsubscribed_at := NULL;",
      "NEW.marketing_consent_active := true;",
      "NEW.marketing_consent_source := 'plan_signup';",
      "NEW.marketing_consent_at := now();",
      "NEW.marketing_unsubscribed_at := NULL;",
    ]) {
      expect(sql).toContain(line);
    }

    // Hard-bounce / complaint suppression survives a new Plan start.
    expect(sql).toContain("NEW.email_suppressed_at := OLD.email_suppressed_at;");
    expect(sql).toContain("NEW.email_suppression_reason := OLD.email_suppression_reason;");
    // No new identity row and no unique-identity change.
    expect(sql).not.toContain("INSERT INTO public.lead_plans");
  });

  it("keeps first-time signup activating both consents on the one inserted identity", () => {
    const sql = readFileSync(CONSENT_MIGRATION, "utf8");
    const trigger = sql.slice(sql.indexOf("FUNCTION public.apply_signup_consent_state"));
    const body = trigger.slice(0, trigger.indexOf("-- 6."));
    expect(body).toContain("BEFORE INSERT ON public.lead_plans");
    expect(body).toContain("NEW.plan_email_consent_source := 'plan_signup';");
    expect(body).toContain("NEW.marketing_consent_source := 'plan_signup';");
    expect(body).toContain("NEW.plan_email_consent_at := now();");
    expect(body).toContain("NEW.marketing_consent_at := now();");

    // One normalized email is exactly one identity.
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS lead_plans_email_normalized_key");
    expect(sql).toContain("ON public.lead_plans (email_normalized)");
  });

  it("contract-tests the pre-production backfill and pre-migration cleanup statements", () => {
    const sql = readFileSync(CONSENT_MIGRATION, "utf8");

    // Backfill: both consents active with an explicit test source and timestamps.
    const backfill = sql.slice(sql.indexOf("UPDATE public.lead_plans SET"), sql.indexOf("-- 4."));
    expect(backfill).toContain("plan_email_consent_active = true");
    expect(backfill).toContain("plan_email_consent_source = 'pre_production_test_backfill'");
    expect(backfill).toContain("marketing_consent_active = true");
    expect(backfill).toContain("marketing_consent_source = 'pre_production_test_backfill'");
    expect(backfill).toContain("plan_email_consent_at = now()");
    expect(backfill).toContain("marketing_consent_at = now()");
    // Suppression columns are never touched by the backfill.
    expect(backfill).not.toContain("email_suppressed_at");
    expect(backfill).not.toContain("email_suppression_reason");

    // Constraints: an active consent always carries a source and a timestamp,
    // and only approved sources are storable.
    expect(sql).toContain("lead_plans_plan_consent_source_chk");
    expect(sql).toContain("lead_plans_marketing_consent_source_chk");
    expect(sql).toContain("lead_plans_plan_consent_active_chk");
    expect(sql).toContain("lead_plans_marketing_consent_active_chk");
    expect(sql).toContain("'plan_signup','plan_recovery','plan_preferences'");

    // Cleanup: every pre-migration nonterminal job of every type is canceled,
    // with one canonical cancellation event each. Terminal history is preserved.
    const cleanup = sql.slice(sql.indexOf("-- 9."));
    expect(cleanup).toContain("WHERE status IN ('pending','processing','retry_scheduled')");
    expect(cleanup).toContain("INSERT INTO public.canonical_events");
    expect(cleanup).toContain("'email_' || closed.job_type || '_canceled'");
    expect(cleanup).not.toContain("DELETE FROM");

    // Service-role-only surface for the consent functions.
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.set_plan_email_consent(uuid, boolean, text) FROM PUBLIC;",
    );
  });
});

describe("authoritative provider-attempt fence migration contract", () => {
  it("verifies lease ownership, Plan consent, and the consent boundary in one atomic step", () => {
    const sql = readFileSync(PROVIDER_FENCE_MIGRATION, "utf8");

    expect(sql).toContain("FUNCTION public.begin_provider_attempt");
    // One locked row, so the decision cannot race a concurrent write.
    expect(sql).toContain("FROM public.email_jobs");
    expect(sql).toContain("FOR UPDATE");
    // 1. lease / processing ownership.
    expect(sql).toContain("v_job.status <> 'processing'");
    expect(sql).toContain("v_job.claim_token <> p_claim_token");
    expect(sql).toContain("RETURN 'lost_lease'");
    // 2. Plan consent active, proactive job types only (Recovery is excluded).
    expect(sql).toContain(
      "v_job.job_type IN ('plan_ready','start_day_1','halfway','stalled','final_rescue','plan_completed')",
    );
    expect(sql).toContain("NOT COALESCE(v_consent_active, false)");
    // 3. job.created_at >= current plan_email_consent_at.
    expect(sql).toContain("v_job.created_at < v_consent_at");
    expect(sql).toContain("RETURN 'consent_blocked'");
    // Provider idempotency: the boundary is only ever filled when empty.
    expect(sql).toContain("COALESCE(first_provider_attempt_at, p_attempted_at)");
    // Service-role-only.
    expect(sql).toContain("FROM PUBLIC;");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.begin_provider_attempt(uuid, uuid, timestamptz) TO service_role;",
    );
  });

  it("wires the production Supabase store to that fence and nothing weaker", () => {
    const source = readFileSync("src/lib/email/store.server.ts", "utf8");
    const fn = source.slice(source.indexOf("async recordFirstProviderAttempt"));
    const body = fn.slice(0, fn.indexOf("async deferJob"));

    expect(body).toContain('client.rpc("begin_provider_attempt"');
    expect(body).toContain('if (data === "ok") return "ok";');
    expect(body).toContain('if (data === "consent_blocked") return "consent_blocked";');
    expect(body).toContain('return "lost_lease";');
    // The weaker application-only update path is gone.
    expect(body).not.toContain('.from("email_jobs")');
  });

  it("keeps the fence as the last write before the provider call in production dispatch", () => {
    const source = readFileSync("src/lib/email/dispatch.ts", "utf8");
    const attempt = source.slice(source.indexOf("async function attemptSend"));
    const body = attempt.slice(0, attempt.indexOf("/** Claims due Plan Ready jobs"));

    const fenceIndex = body.indexOf("recordFirstProviderAttempt");
    const sendIndex = body.indexOf("deps.adapter.send");
    expect(fenceIndex).toBeGreaterThan(-1);
    expect(sendIndex).toBeGreaterThan(fenceIndex);
    expect(body).toContain(
      'if (fence === "consent_blocked") return finish(deps, job, "canceled", {});',
    );
    expect(body).toContain(
      'if (fence !== "ok") return { jobId: job.job_id, outcome: "lost_lease" };',
    );
  });
});
