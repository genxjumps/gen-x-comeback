import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createFakeAdapter } from "@/lib/email/adapters.server";
import {
  dispatchPaidAccessJobs,
  type PaidAccessDispatchDeps,
} from "@/lib/email/paid-access-dispatch.server";
import type { PaidAccessStore } from "@/lib/email/paid-access-store.server";
import { PAID_ACCESS_CTA, renderPaidAccessEmail } from "@/lib/email/paid-access-template";
import type { PaidAccessJobRow } from "@/lib/email/paid-access-types";

const NOW = new Date("2026-09-06T12:00:00.000Z");
const CUSTOMER = "00000000-0000-4000-8000-000000000001";
const ENTITLEMENT = "00000000-0000-4000-8000-000000000002";
const JOB = "00000000-0000-4000-8000-000000000003";

function makeJob(overrides: Partial<PaidAccessJobRow> = {}): PaidAccessJobRow {
  return {
    job_id: JOB,
    job_type: "paid_purchase_access",
    job_version: "v1",
    template_version: "paid_access_v1",
    customer_id: CUSTOMER,
    entitlement_id: ENTITLEMENT,
    idempotency_key: `paid_purchase_access:${JOB}:v1`,
    eligible_at: NOW.toISOString(),
    status: "pending",
    delivery_status: "pending",
    attempt_count: 0,
    next_attempt_at: null,
    locked_at: null,
    lease_expires_at: null,
    claim_token: null,
    first_provider_attempt_at: null,
    provider_key: null,
    provider_message_id: null,
    provider_accepted_at: null,
    delivered_at: null,
    last_error_code: null,
    last_error_at: null,
    canceled_at: null,
    suppression_reason: null,
    manual_review_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function harness(input?: {
  job?: PaidAccessJobRow;
  active?: boolean;
  suppression?: string | null;
}) {
  const job = input?.job ?? makeJob();
  const queued = [job];
  const tokens: Array<{ tokenHash: string; jobId: string }> = [];
  const finishes: Array<{ status: string; event?: string }> = [];
  const store: PaidAccessStore = {
    async claimJobs(jobType) {
      const index = queued.findIndex((candidate) => candidate.job_type === jobType);
      if (index < 0) return [];
      const [claimed] = queued.splice(index, 1);
      return [{ ...claimed!, attempt_count: claimed!.attempt_count + 1, claim_token: "claim" }];
    },
    async getCustomer() {
      return {
        id: CUSTOMER,
        auth_user_id: "00000000-0000-4000-8000-000000000004",
        email_original: "buyer@example.com",
        email_normalized: "buyer@example.com",
      };
    },
    async entitlementIsActive() {
      return input?.active ?? true;
    },
    async suppressionReason() {
      return input?.suppression ?? null;
    },
    async upsertToken(token) {
      tokens.push({ tokenHash: token.tokenHash, jobId: token.jobId });
    },
    async beginProviderAttempt() {
      return { outcome: "ok", submissionAttemptId: "attempt-1" };
    },
    async completeProviderAttempt() {
      return true;
    },
    async finishJob(_job, status, _patch, event) {
      finishes.push({ status, ...(event ? { event } : {}) });
      return true;
    },
    async deferJob() {
      return true;
    },
    async reconcileProviderEvents() {
      return 0;
    },
  };
  const adapter = createFakeAdapter();
  const deps: PaidAccessDispatchDeps = {
    store,
    adapter,
    now: () => NOW,
    appOrigin: "https://app.genxjumps.com",
    fromEmail: "hello@genxjumps.com",
    fromName: "Todd from Gen X Jumps",
    replyTo: "hello@genxjumps.com",
    tokenSecret: "paid-access-test-secret-value-0123456789",
    hash: async (value) => createHash("sha256").update(value).digest("hex"),
  };
  return { adapter, deps, finishes, tokens };
}

describe("paid access email", () => {
  it("sends one transactional purchase email with a reusable app-origin link", async () => {
    const { adapter, deps, finishes, tokens } = harness();
    const result = await dispatchPaidAccessJobs(deps);

    expect(result.purchase.outcomes.map((outcome) => outcome.outcome)).toEqual([
      "provider_accepted",
    ]);
    expect(adapter.requests).toHaveLength(1);
    expect(adapter.requests[0]!.to).toBe("buyer@example.com");
    expect(adapter.requests[0]!.text).toContain("https://app.genxjumps.com/account/return?token=");
    expect(adapter.requests[0]!.disableClickTracking).toBe(true);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(finishes).toEqual([
      { status: "provider_accepted", event: "paid_purchase_access_provider_accepted" },
    ]);
  });

  it("uses the recovery copy and never consults marketing or Plan-email consent", async () => {
    const { adapter, deps } = harness({
      job: makeJob({
        job_type: "paid_recovery",
        idempotency_key: `paid_recovery:${CUSTOMER}:request-1:v1`,
      }),
    });
    const result = await dispatchPaidAccessJobs(deps);
    expect(result.recovery.outcomes[0]!.outcome).toBe("provider_accepted");
    expect(adapter.requests[0]!.subject).toBe("Your secure Gen X Jumps access link");
    expect(adapter.requests[0]!.text.toLowerCase()).not.toContain("marketing");
    expect(adapter.requests[0]!.text.toLowerCase()).not.toContain("unsubscribe");
  });

  it("suppresses hard bounces and complaints before provider submission", async () => {
    for (const suppression of ["hard_bounce", "complaint"]) {
      const { adapter, deps } = harness({ suppression });
      const result = await dispatchPaidAccessJobs(deps);
      expect(result.purchase.outcomes[0]!.outcome).toBe("suppressed");
      expect(adapter.requests).toHaveLength(0);
    }
  });

  it("cancels instead of issuing a link after entitlement revocation", async () => {
    const { adapter, deps, tokens } = harness({ active: false });
    const result = await dispatchPaidAccessJobs(deps);
    expect(result.purchase.outcomes[0]!.outcome).toBe("canceled");
    expect(adapter.requests).toHaveLength(0);
    expect(tokens).toHaveLength(0);
  });

  it("sends account recovery with no active ownership but keeps suppression", async () => {
    for (const suppression of [null, "hard_bounce", "complaint"]) {
      const { adapter, deps } = harness({
        active: false,
        suppression,
        job: makeJob({ job_type: "paid_recovery", entitlement_id: null }),
      });
      const result = await dispatchPaidAccessJobs(deps);
      expect(result.recovery.outcomes[0]!.outcome).toBe(
        suppression ? "suppressed" : "provider_accepted",
      );
      expect(adapter.requests).toHaveLength(suppression ? 0 : 1);
    }
  });

  it("does not treat malformed purchase or legacy recovery jobs as account access", async () => {
    for (const job of [makeJob({ entitlement_id: null }), makeJob({ job_type: "paid_recovery" })]) {
      const { adapter, deps } = harness({ active: false, job });
      await dispatchPaidAccessJobs(deps);
      expect(adapter.requests).toHaveLength(0);
    }
  });

  it("renders purchase and recovery messages without marketing content", () => {
    for (const kind of ["purchase", "recovery"] as const) {
      const rendered = renderPaidAccessEmail({
        kind,
        returnUrl: "https://app.genxjumps.com/account/return?token=test",
      });
      expect(rendered.text).toContain(kind === "purchase" ? PAID_ACCESS_CTA : "Sign In");
      expect(rendered.html).toContain(kind === "purchase" ? PAID_ACCESS_CTA : "Sign In");
      expect(rendered.text.toLowerCase()).not.toContain("unsubscribe");
      expect(rendered.text.toLowerCase()).not.toContain("weight");
      expect(rendered.text.toLowerCase()).not.toContain("progress");
    }
  });
});

describe("paid recovery migration and route contracts", () => {
  const migration = readFileSync(
    "supabase/migrations/20260906100000_paid_access_email_recovery.sql",
    "utf8",
  );
  const route = readFileSync("src/routes/account.return.ts", "utf8");
  const exchange = readFileSync("src/lib/account/paid-access-exchange.server.ts", "utf8");

  it("keeps all paid email, token, event, and provider data service-role-only", () => {
    expect(migration).toContain("CREATE TABLE public.paid_access_email_jobs");
    expect(migration).toContain("CREATE TABLE public.paid_access_tokens");
    expect(migration).toContain("CREATE TABLE public.paid_access_email_events");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.paid_access_email_jobs FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.paid_access_tokens FROM PUBLIC, anon, authenticated",
    );
  });

  it("writes the purchase email job atomically inside ownership provisioning", () => {
    const ownership = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.provision_accelerator_ownership"),
    );
    expect(ownership).toContain("PERFORM public.enqueue_paid_access_job(");
    expect(ownership).toContain("'paid_purchase_access'");
    expect(ownership).toContain("'paid_purchase_access:' || v_purchase.id::text || ':v1'");
  });

  it("uses a separate fail-closed paid sending gate and the shared provider ceiling", () => {
    expect(migration).toContain("paid_access_sending_enabled boolean NOT NULL DEFAULT false");
    expect(migration).toContain("paid_access_customers_admitted boolean NOT NULL DEFAULT false");
    expect(migration).toContain("controlled_paid_customer_id uuid");
    expect(migration).toContain("INSERT INTO public.email_provider_submissions");
    expect(migration).toContain("ADD CONSTRAINT email_provider_submission_owner_check");
  });

  it("prefers paid recovery without revealing a match and preserves free-only recovery", () => {
    const recovery = migration.slice(
      migration.indexOf("FUNCTION public.request_customer_access_recovery"),
      migration.indexOf("FUNCTION public.claim_production_paid_access_email_jobs"),
    );
    expect(recovery).toContain("RETURNS void");
    expect(recovery).toContain("'paid_recovery'");
    expect(recovery).toContain("PERFORM public.request_plan_recovery");
    expect(recovery).not.toContain("RETURN QUERY");
  });

  it("makes GET scanner-safe and performs validation only after deliberate POST", () => {
    expect(route).toContain("GET: async");
    expect(route).toContain("POST: async");
    expect(route.indexOf("exchangePaidAccessToken")).toBeGreaterThan(route.indexOf("POST: async"));
    expect(route).toContain("status: 303");
    expect(route).toContain("#gxj_auth=");
  });

  it("allows token reuse while enforcing expiry, revocation, and active ownership", () => {
    expect(exchange).toContain('.eq("status", "active")');
    expect(exchange).toContain("token.revoked_at");
    expect(exchange).toContain("token.expires_at");
    expect(exchange).toContain("auth.admin.generateLink");
    expect(exchange).toContain("use_count: token.use_count + 1");
    expect(exchange).not.toContain("revoked_at: nowIso");
  });
});
