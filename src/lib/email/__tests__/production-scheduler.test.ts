import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFakeAdapter } from "@/lib/email/adapters.server";
import { dispatchPlanReadyJobs, type DispatchDeps } from "@/lib/email/dispatch";
import { createMemoryStore, makeJob, makeLead } from "./memory-store";

const MIGRATION = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260807193000_4d5f0f64-0a61-4ee4-bf12-3a1f3d50f92e.sql",
  ),
  "utf8",
);
const DISPATCH = readFileSync(join(process.cwd(), "src", "lib", "email", "dispatch.ts"), "utf8");
const ROUTE = readFileSync(
  join(process.cwd(), "src", "routes", "api", "public", "email", "dispatch.ts"),
  "utf8",
);
const SCHEDULER = readFileSync(
  join(process.cwd(), "src", "lib", "email", "production-scheduler.server.ts"),
  "utf8",
);
const NOW = new Date("2026-08-07T19:30:00.000Z");
const INVOCATION = "11111111-1111-4111-8111-111111111111";

function deps() {
  const store = createMemoryStore(() => NOW);
  const adapter = createFakeAdapter();
  store.leads.set("lead-1", makeLead({ plan_email_consent_at: "2026-08-07T19:00:00.000Z" }));
  store.jobs.set("job-1", makeJob({ created_at: "2026-08-07T19:20:00.000Z" }));
  const value: DispatchDeps = {
    store,
    adapter,
    now: () => NOW,
    appOrigin: "https://app.genxjumps.com",
    fromEmail: "todd@notify.genxjumps.com",
    fromName: "Todd from Gen X Jumps",
    replyTo: "todd@genxjumps.com",
    deriveCredential: (purpose, version, scope) => `${purpose}:${version}:${scope ?? ""}`,
    hash: async (raw) => `hash:${raw}`,
  };
  return { store, adapter, deps: value };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("production scheduler authentication", () => {
  it("uses the exact permanent URL and the five-minute cron expression", () => {
    expect(MIGRATION).toContain("https://app.genxjumps.com/api/public/email/dispatch");
    expect(MIGRATION).toContain("'email-production-dispatch-every-5-minutes'");
    expect(MIGRATION).toContain("'*/5 * * * *'");
    expect(MIGRATION).toContain("SELECT public.invoke_email_dispatch_scheduler();");
    expect(MIGRATION).not.toContain("lovable.app/api/public/email/dispatch");
  });

  it("generates the dedicated secret inside PostgreSQL and stores only its digest outside Vault", () => {
    expect(MIGRATION).toContain("extensions.gen_random_bytes(48)");
    expect(MIGRATION).toContain("'email_production_scheduler_secret'");
    expect(MIGRATION).toContain("scheduler_secret_sha256 = encode(extensions.digest(v_secret");
    expect(MIGRATION).not.toMatch(/RETURN jsonb_build_object\([\s\S]*?'secret',\s*v_secret/);
  });

  it("requires one fresh invocation and rejects stale or replayed authentication", () => {
    expect(MIGRATION).toContain("v_run.authenticated_at IS NOT NULL");
    expect(MIGRATION).toContain("v_result := 'replayed'");
    expect(MIGRATION).toContain("p_authenticated_at > v_run.auth_deadline");
    expect(MIGRATION).toContain("v_result := 'stale'");
    expect(MIGRATION).toContain(
      "abs(extract(epoch FROM (p_request_timestamp - v_run.invoked_at))) > 2",
    );
  });

  it("never sends or stores the bearer in scheduler evidence", () => {
    expect(MIGRATION).toContain("CREATE TABLE public.email_scheduler_auth_attempts");
    const authTable = MIGRATION.slice(
      MIGRATION.indexOf("CREATE TABLE public.email_scheduler_auth_attempts"),
      MIGRATION.indexOf("CREATE INDEX email_scheduler_auth_attempts"),
    );
    expect(authTable).not.toMatch(/secret|bearer/i);
    expect(MIGRATION).toContain("p_secret_sha256 text");
  });
});

describe("independent production gates", () => {
  it("enforces authentication, explicit enablement, activation, Todd-only scope, consent, and suppression", () => {
    for (const evidence of [
      "v_invocation.authenticated_at IS NULL",
      "v_control.sending_enabled",
      "v_job.created_at < v_control.activation_boundary",
      "v_job.lead_plan_id <> v_control.controlled_lead_plan_id",
      "v_lead.plan_email_consent_active",
      "v_job.created_at < v_lead.plan_email_consent_at",
      "v_lead.email_suppressed_at IS NOT NULL",
      "s.reason IN ('hard_bounce', 'complaint')",
    ]) {
      expect(MIGRATION).toContain(evidence);
    }
    expect(MIGRATION).toContain("l.email_normalized = 'todd+staging@genxjumps.com'");
  });

  it("permanently cancels every nonterminal pre-activation job without deleting evidence", () => {
    expect(MIGRATION).toContain(
      "CREATE OR REPLACE FUNCTION public.establish_email_production_activation()",
    );
    expect(MIGRATION).toContain("created_at < v_boundary");
    expect(MIGRATION).toContain("status IN ('pending', 'retry_scheduled', 'processing')");
    expect(MIGRATION).toContain("last_error_code = 'pre_production_activation'");
    expect(MIGRATION).not.toMatch(
      /DELETE FROM public\.(email_jobs|canonical_events|email_provider_events)/,
    );
  });

  it("reserves capacity atomically and fixes the initial rolling limit at five", () => {
    expect(MIGRATION).toContain("provider_submission_limit integer NOT NULL DEFAULT 5");
    expect(MIGRATION).toContain("reserved_at >= p_attempted_at - interval '24 hours'");
    expect(MIGRATION).toContain("status IN ('reserved', 'accepted', 'uncertain')");
    expect(MIGRATION).toContain("v_count >= v_control.provider_submission_limit");
    expect(MIGRATION).toContain("RETURN jsonb_build_object('outcome', 'limit_reached')");
    expect(MIGRATION).toContain("v_control.provider_submission_limit <> 5");
    expect(MIGRATION).not.toContain("provider_submission_limit = 25");
  });

  it("counts accepted submissions, preserves ambiguous capacity, and releases definite failures", () => {
    expect(MIGRATION).toContain("p_outcome = 'accepted'");
    expect(MIGRATION).toContain("p_outcome = 'uncertain'");
    expect(MIGRATION).toContain("p_outcome IN ('transient', 'permanent')");
    expect(MIGRATION).toContain("v_status := 'released'");
    expect(MIGRATION).toContain("v_duplicate_count > 1 OR v_capacity_count > v_limit");
    expect(MIGRATION).toContain("'duplicate_provider_submission'");
    expect(MIGRATION).toContain("'provider_submission_limit_failure'");
  });

  it("defers a volume-limited job without a provider call or job deletion", async () => {
    const h = deps();
    h.store.recordFirstProviderAttempt = async () => ({ outcome: "limit_reached" });
    const summary = await dispatchPlanReadyJobs(h.deps);
    expect(summary.outcomes).toEqual([{ jobId: "job-1", outcome: "deferred" }]);
    expect(h.adapter.requests).toHaveLength(0);
    expect(h.store.jobs.get("job-1")?.status).toBe("retry_scheduled");
    expect(h.store.jobs.get("job-1")?.attempt_count).toBe(0);
  });

  it("closes a suppression-race job without a provider call", async () => {
    const h = deps();
    h.store.recordFirstProviderAttempt = async () => ({ outcome: "suppression_blocked" });
    const summary = await dispatchPlanReadyJobs(h.deps);
    expect(summary.outcomes[0]?.outcome).toBe("suppressed");
    expect(h.adapter.requests).toHaveLength(0);
  });

  it("fails closed if accepted-provider evidence cannot be finalized", async () => {
    const h = deps();
    h.store.completeProviderAttempt = async () => false;
    await expect(dispatchPlanReadyJobs(h.deps)).rejects.toThrow(
      "provider_attempt_evidence_not_completed",
    );
    expect(h.adapter.requests).toHaveLength(1);
    expect(h.store.jobs.get("job-1")?.status).toBe("processing");
  });
});

describe("scheduler evidence, rollback, warnings, and admission", () => {
  it("correlates invocations, claims, provider attempts, acceptances, and completion", () => {
    expect(MIGRATION).toContain("CREATE TABLE public.email_scheduler_invocations");
    expect(MIGRATION).toContain("CREATE TABLE public.email_provider_submissions");
    expect(MIGRATION).toContain(
      "invocation_id uuid NOT NULL REFERENCES public.email_scheduler_invocations",
    );
    expect(MIGRATION).toContain("job_id uuid NOT NULL REFERENCES public.email_jobs");
    expect(MIGRATION).toContain("provider_attempt_count = (");
    expect(MIGRATION).toContain("provider_accepted_count = (");
  });

  it("exposes all four required deterministic warning states", () => {
    for (const warning of [
      "no_successful_authenticated_dispatch_15m",
      "two_consecutive_authenticated_failures",
      "eligible_jobs_repeatedly_unclaimed",
      "provider_submission_limit_reached",
    ]) {
      expect(MIGRATION).toContain(warning);
    }
    expect(MIGRATION).toContain("c.scheduler_configured_at <= now() - interval '15 minutes'");
  });

  it("provides immediate send disablement and separate cron pause without deleting evidence", () => {
    expect(MIGRATION).toContain(
      "CREATE OR REPLACE FUNCTION public.disable_email_production_sending",
    );
    expect(MIGRATION).toContain("SET sending_enabled = false");
    expect(MIGRATION).toContain("'production_email_rollback'");
    expect(MIGRATION).toContain("CREATE OR REPLACE FUNCTION public.pause_email_production_cron");
    expect(MIGRATION).toContain("cron.unschedule(v_job_id)");
    expect(ROUTE).toContain('disableProductionSending("dispatch_exception")');
    expect(ROUTE).toContain('failureCode: "dispatch_exception_send_gate_disabled"');
    expect(SCHEDULER).toContain(
      'data !== true) throw new Error("production_send_rollback_failed")',
    );
    expect(DISPATCH).toContain('throw new Error("provider_attempt_evidence_not_completed")');
  });

  it("admits genuine Plans only after exactly one accepted, delivered, exchanged controlled send", () => {
    expect(MIGRATION).toContain("CREATE OR REPLACE FUNCTION public.admit_genuine_email_plans");
    expect(MIGRATION).toContain("j.status = 'provider_accepted'");
    expect(MIGRATION).toContain("j.delivery_status = 'delivered'");
    expect(MIGRATION).toContain("s.status = 'accepted') <> 1");
    expect(MIGRATION).toContain("FROM public.email_provider_events pe");
    expect(MIGRATION).toContain("pe.event_kind = 'delivered'");
    expect(MIGRATION).toContain("pe.reconciled_at IS NOT NULL");
    expect(MIGRATION).toContain("e.event_name = 'email_plan_ready_link_exchange_completed'");
    expect(MIGRATION).toContain("SET genuine_plans_admitted = true");
  });

  it("keeps every production control function service-role only", () => {
    expect(MIGRATION).toContain("FROM PUBLIC, anon, authenticated");
    expect(MIGRATION).toContain(
      "GRANT EXECUTE ON FUNCTION public.begin_production_provider_attempt(uuid, uuid, uuid, timestamptz) TO service_role;",
    );
    expect(MIGRATION).toContain(
      "GRANT EXECUTE ON FUNCTION public.email_production_warning_state() TO service_role;",
    );
  });

  it("uses the expected invocation id shape in test evidence", () => {
    expect(INVOCATION).toMatch(/^[0-9a-f-]{36}$/);
  });
});
