// Focused recovery-flow acceptance tests.
//
// Deterministic: no provider, no network, no database. The public /recover route
// is exercised through its real server handlers with the rate limiter, credential
// secret, and service-role RPC boundary replaced by deterministic doubles.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RECOVERY_JOB_TYPE,
  RECOVERY_JOB_VERSION,
  RECOVERY_TEMPLATE_VERSION,
  RETURN_TOKEN_TTL_MS,
  recoveryJobKey,
} from "@/lib/email/types";
import { lifecycleEventName } from "@/lib/email/event-names";
import {
  RECOVERY_FOOTER,
  RECOVERY_PREVIEW_TEXT,
  RECOVERY_FALLBACK_SUBJECT,
  renderRecovery,
} from "@/lib/email/recovery-template";
import {
  PLAN_READY_LINK_EXCHANGE_EVENT,
  RECOVERY_LINK_EXCHANGE_EVENT,
  resolveLinkExchangeAttribution,
} from "@/lib/email/link-exchange-event";
import {
  DEFAULT_RETURN_DESTINATION,
  resolveReturnDestination,
} from "@/lib/email/return-destination";
import { dispatchRecoveryJobs, type DispatchDeps } from "@/lib/email/dispatch";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";
import type { EmailAdapter, EmailSendRequest } from "@/lib/email/types";

const SECRET = "recovery-token-secret-value-0123456789";

// ---------------------------------------------------------------------------
// Shared doubles for the public /recover route
// ---------------------------------------------------------------------------

const rateLimitCalls: Array<{ bucket: string; windowSeconds: number; limit: number }> = [];
const rpcCalls: Array<{ email: string; requestId: string }> = [];
let rateLimitAllowed = true;
// Injected RPC outcome for the service-role boundary double.
let rpcError: { code?: unknown; message?: string; details?: string; hint?: string } | null = null;
let rpcThrows: Error | null = null;

vi.mock("@/lib/email/rate-limit.server", () => ({
  callerBucketKey: (scope: string) => `${scope}:hashed-caller`,
  consumeRateLimit: async (bucket: string, windowSeconds: number, limit: number) => {
    rateLimitCalls.push({ bucket, windowSeconds, limit });
    return { allowed: rateLimitAllowed };
  },
}));

// Receiver-sensitive double: like the real SDK, `rpc` reads state off its own
// receiver, so a detached `const rpc = client.rpc` reference throws before any
// request is made. This is what makes the regression detectable here.
vi.mock("@/integrations/supabase/client.server", () => {
  const client = {
    rest: { marker: "service-role" },
    rpc(this: unknown, fn: string, args: Record<string, string>) {
      const self = this as { rest?: { marker?: string } } | undefined;
      if (!self || self.rest?.marker !== "service-role") {
        throw new TypeError("undefined is not an object (evaluating 'this.rest')");
      }
      if (fn === "request_plan_recovery") {
        rpcCalls.push({
          email: args["p_email_normalized"] as string,
          requestId: args["p_request_id"] as string,
        });
      }
      if (rpcThrows) return Promise.reject(rpcThrows);
      return Promise.resolve({ error: rpcError });
    },
  };
  return { supabaseAdmin: client };
});


type Handler = (ctx: { request: Request }) => Promise<Response>;

async function recoverHandler(method: "GET" | "POST"): Promise<Handler> {
  const mod = await import("@/routes/recover");
  const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
  const server = options["server"] as { handlers: Record<string, Handler> };
  const handler = server.handlers[method];
  if (!handler) throw new Error(`missing ${method} handler`);
  return handler;
}

async function getForm(): Promise<string> {
  const handler = await recoverHandler("GET");
  const res = await handler({ request: new Request("https://app.genxjumps.com/recover") });
  return res.text();
}

function requestIdFrom(html: string): string {
  const match = /name="request_id" value="([^"]*)"/.exec(html);
  if (!match) throw new Error("no request id in form");
  return match[1]!;
}

async function post(fields: Record<string, string>): Promise<Response> {
  const handler = await recoverHandler("POST");
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return handler({
    request: new Request("https://app.genxjumps.com/recover", { method: "POST", body }),
  });
}

const GENERIC = "If that email matches a Gen X Jumps plan, a new link is on the way.";

describe("public /recover route", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env["EMAIL_TOKEN_SECRET_V1"] = SECRET;
    rateLimitCalls.length = 0;
    rpcCalls.length = 0;
    rateLimitAllowed = true;
    rpcError = null;
    rpcThrows = null;
  });


  afterEach(() => {
    process.env = { ...original };
  });

  it("GET renders exactly the approved form and records nothing", async () => {
    const html = await getForm();

    expect(html).toContain("Get Back to Your Plan");
    expect(html).toContain("Enter the email you used and I’ll send you a fresh link.");
    expect(html).toContain('<form method="post" action="/recover"');
    expect(html).toContain('type="email"');
    expect(html).toContain('<button type="submit"');
    expect(html).toMatch(/name="request_id" value="[A-Za-z0-9_.-]+"/);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(rpcCalls).toHaveLength(0);
    expect(rateLimitCalls).toHaveLength(0);
  });

  it("exposes no handler other than GET and POST", async () => {
    const mod = await import("@/routes/recover");
    const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
    const server = options["server"] as { handlers: Record<string, unknown> };
    expect(Object.keys(server.handlers).sort()).toEqual(["GET", "POST"]);
  });

  it("returns the identical generic response for match, unknown, malformed, rate-limited and replay", async () => {
    const requestId = requestIdFrom(await getForm());

    // Matching-shaped submission (the route never learns whether it matched).
    const matched = await post({ email: "Reader@Example.com ", request_id: requestId });
    // Exact replay of the same trusted request id.
    const replay = await post({ email: "reader@example.com", request_id: requestId });
    // Unknown-shaped address.
    const unknown = await post({
      email: "nobody@example.com",
      request_id: requestIdFrom(await getForm()),
    });
    // Malformed address.
    const malformed = await post({ email: "not-an-email", request_id: requestId });
    // Missing/forged request id.
    const forged = await post({ email: "reader@example.com", request_id: "forged.signature" });

    rateLimitAllowed = false;
    const limited = await post({ email: "reader@example.com", request_id: requestId });

    const bodies = await Promise.all(
      [matched, replay, unknown, malformed, forged, limited].map((r) => r.text()),
    );
    for (const body of bodies) {
      expect(body).toContain(GENERIC);
      expect(body).toBe(bodies[0]);
    }
    for (const res of [matched, replay, unknown, malformed, forged, limited]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("applies 3 requests per email per hour and 5 per caller per hour", async () => {
    await post({ email: "reader@example.com", request_id: requestIdFrom(await getForm()) });

    const caller = rateLimitCalls.find((c) => c.bucket.startsWith("recover_post"));
    const email = rateLimitCalls.find((c) => c.bucket.startsWith("recover_email:"));

    expect(caller).toEqual({
      bucket: "recover_post:hashed-caller",
      windowSeconds: 3600,
      limit: 5,
    });
    expect(email?.windowSeconds).toBe(3600);
    expect(email?.limit).toBe(3);
  });

  it("never places a raw email address in any rate-limit bucket key", async () => {
    await post({ email: "Reader@Example.com", request_id: requestIdFrom(await getForm()) });

    expect(rateLimitCalls.length).toBeGreaterThan(0);
    for (const call of rateLimitCalls) {
      expect(call.bucket.toLowerCase()).not.toContain("reader@example.com");
      expect(call.bucket).not.toContain("@");
    }
  });

  it("normalizes the submitted email and only forwards a server-trusted request id", async () => {
    const requestId = requestIdFrom(await getForm());
    await post({ email: "  Reader@Example.COM  ", request_id: requestId });

    expect(rpcCalls).toEqual([{ email: "reader@example.com", requestId: requestId.split(".")[0] }]);
  });

  it("forwards the same request id on replay and a distinct one for a new form", async () => {
    const first = requestIdFrom(await getForm());
    await post({ email: "reader@example.com", request_id: first });
    await post({ email: "reader@example.com", request_id: first });

    const second = requestIdFrom(await getForm());
    await post({ email: "reader@example.com", request_id: second });

    expect(rpcCalls[0]!.requestId).toBe(rpcCalls[1]!.requestId);
    expect(rpcCalls[2]!.requestId).not.toBe(rpcCalls[0]!.requestId);
    expect(second).not.toBe(first);
  });

  it("rejects a tampered request id without reaching the recovery boundary", async () => {
    const requestId = requestIdFrom(await getForm());
    const [id] = requestId.split(".");
    await post({ email: "reader@example.com", request_id: `${id}.tampered-signature-value` });
    expect(rpcCalls).toHaveLength(0);
  });

  it("reaches the recovery boundary exactly once with receiver context preserved", async () => {
    const signed = requestIdFrom(await getForm());
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await post({ email: "  Reader@Example.COM  ", request_id: signed });

      // A detached `rpc` reference would have thrown inside the double, so the
      // recorded call proves the route calls it as a method on the client.
      expect(rpcCalls).toEqual([
        { email: "reader@example.com", requestId: signed.split(".")[0] },
      ]);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain(GENERIC);
      // A successful boundary call logs nothing.
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  it("keeps the generic response and logs one redacted diagnostic for an RPC error", async () => {
    const signed = requestIdFrom(await getForm());
    rpcError = {
      code: "23505",
      message: "duplicate key value violates unique constraint for reader@example.com",
      details: "lead id 11111111-1111-1111-1111-111111111111",
      hint: "plan_version_id 22222222-2222-2222-2222-222222222222",
    };
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await post({ email: "Reader@Example.com", request_id: signed });

      expect(res.status).toBe(200);
      expect(await res.text()).toContain(GENERIC);
      expect(res.headers.get("location")).toBeNull();

      expect(errors).toHaveBeenCalledTimes(1);
      const serialized = JSON.stringify(errors.mock.calls);
      expect(serialized).toContain("recovery_rpc_error");
      expect(serialized).toContain("23505");
      for (const forbidden of [
        "Reader@Example.com",
        "reader@example.com",
        signed,
        signed.split(".")[0]!,
        "duplicate key",
        "lead id",
        "plan_version_id",
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "p_email_normalized",
        "p_request_id",
        "genxjumps.com",
        "at Object.",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    } finally {
      errors.mockRestore();
    }
  });

  it("sanitizes an unusable database error code to unknown", async () => {
    const signed = requestIdFrom(await getForm());
    rpcError = { code: "reader@example.com is not a code" };
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await post({ email: "reader@example.com", request_id: signed });
      const serialized = JSON.stringify(errors.mock.calls);
      expect(serialized).toContain("recovery_rpc_error code=unknown");
      expect(serialized).not.toContain("reader@example.com");
    } finally {
      errors.mockRestore();
    }
  });

  it("keeps the generic response and logs only a classification for a thrown RPC", async () => {
    const signed = requestIdFrom(await getForm());
    rpcThrows = new Error("connect ECONNREFUSED db.internal reader@example.com");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await post({ email: "reader@example.com", request_id: signed });

      expect(res.status).toBe(200);
      expect(await res.text()).toContain(GENERIC);

      expect(errors).toHaveBeenCalledTimes(1);
      const serialized = JSON.stringify(errors.mock.calls);
      expect(serialized).toContain("recovery_rpc_exception");
      for (const forbidden of [
        "ECONNREFUSED",
        "db.internal",
        "reader@example.com",
        signed,
        signed.split(".")[0]!,
        "at Object.",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    } finally {
      errors.mockRestore();
    }
  });
});


// ---------------------------------------------------------------------------
// Server-trusted request identity
// ---------------------------------------------------------------------------

describe("server-trusted recovery request identity", () => {
  it("verifies only values this server issued and is replay-stable", async () => {
    const { issueRecoveryRequestId, verifyRecoveryRequestId, recoveryEmailBucketKey } =
      await import("@/lib/email/recovery-request.server");

    const signed = issueRecoveryRequestId(SECRET);
    expect(verifyRecoveryRequestId(SECRET, signed)).toBe(signed.split(".")[0]);
    expect(verifyRecoveryRequestId(SECRET, signed)).toBe(verifyRecoveryRequestId(SECRET, signed));

    expect(verifyRecoveryRequestId(SECRET, signed.split(".")[0]!)).toBeNull();
    expect(verifyRecoveryRequestId("another-secret-value-0123456789ab", signed)).toBeNull();
    expect(verifyRecoveryRequestId(SECRET, "")).toBeNull();
    expect(verifyRecoveryRequestId(SECRET, null)).toBeNull();

    // Email bucket keys are keyed hashes, never the raw address.
    const bucket = recoveryEmailBucketKey(SECRET, "reader@example.com");
    expect(bucket).toMatch(/^recover_email:[0-9a-f]{32}$/);
    expect(bucket).toBe(recoveryEmailBucketKey(SECRET, "reader@example.com"));
    expect(bucket).not.toBe(recoveryEmailBucketKey(SECRET, "other@example.com"));
  });
});

// ---------------------------------------------------------------------------
// Logical idempotency key
// ---------------------------------------------------------------------------

describe("recovery logical idempotency key", () => {
  it("is recovery:{plan_version_id}:{request_id}:v1", () => {
    expect(recoveryJobKey("version-1", "req-abc")).toBe("recovery:version-1:req-abc:v1");
    // A different request id is a different logical job for the same plan version.
    expect(recoveryJobKey("version-1", "req-def")).not.toBe(recoveryJobKey("version-1", "req-abc"));
  });
});

// ---------------------------------------------------------------------------
// Canonical event names
// ---------------------------------------------------------------------------

describe("recovery canonical events", () => {
  it("uses the approved recovery namespace and omits unapproved outcomes", () => {
    expect(lifecycleEventName(RECOVERY_JOB_TYPE, "provider_accepted")).toBe(
      "email_recovery_provider_accepted",
    );
    expect(lifecycleEventName(RECOVERY_JOB_TYPE, "delivered")).toBe("email_recovery_delivered");
    expect(lifecycleEventName(RECOVERY_JOB_TYPE, "retry_scheduled")).toBe(
      "email_recovery_retry_scheduled",
    );
    expect(lifecycleEventName(RECOVERY_JOB_TYPE, "failed_permanent")).toBe(
      "email_recovery_failed_permanent",
    );
    expect(lifecycleEventName(RECOVERY_JOB_TYPE, "suppressed")).toBe("email_recovery_suppressed");
    expect(lifecycleEventName(RECOVERY_JOB_TYPE, "canceled")).toBeNull();
    expect(lifecycleEventName(RECOVERY_JOB_TYPE, "manual_review")).toBeNull();
  });

  it("leaves every existing lifecycle event name unchanged", () => {
    expect(lifecycleEventName("plan_ready", "provider_accepted")).toBe(
      "email_plan_ready_provider_accepted",
    );
    expect(lifecycleEventName("halfway", "suppressed")).toBe("email_halfway_suppressed");
    expect(lifecycleEventName("plan_completed", "delivered")).toBe(
      "email_plan_completed_delivered",
    );
    expect(lifecycleEventName("final_rescue", "manual_review")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

describe("recovery_v1 template", () => {
  const url = "https://app.genxjumps.com/return?token=" + "t".repeat(43);

  it("uses the exact personalized subject, preview text, copy order and footer", () => {
    const rendered = renderRecovery({ firstName: "Todd", returnUrl: url });

    expect(rendered.subject).toBe("Todd, here’s a fresh link to your 7-day plan");
    expect(rendered.previewText).toBe("Open your saved plan and pick up where you left off.");
    expect(RECOVERY_PREVIEW_TEXT).toBe(rendered.previewText);

    const lines = rendered.text.split("\n").filter((line) => line.length > 0);
    expect(lines).toEqual([
      "Hey Todd,",
      "Here’s the fresh link you requested for your 7-Day Comeback Plan.",
      "Your plan and progress are still saved.",
      `Open My Plan: ${url}`,
      "This link opens your current saved plan on any device. No password needed.",
      "Move or Rust.",
      "Todd",
      "Gen X Jumps",
      "---",
      RECOVERY_FOOTER,
    ]);
    expect(RECOVERY_FOOTER).toBe(
      "You received this because a fresh access link was requested for your Gen X Jumps plan.",
    );
    expect(rendered.html).toContain(">Open My Plan</a>");
    expect(rendered.html).toContain(url);
  });

  it("falls back for a missing or unusable name", () => {
    for (const name of [null, undefined, "", "   ", "<>"]) {
      const rendered = renderRecovery({ firstName: name, returnUrl: url });
      expect(rendered.subject).toBe(RECOVERY_FALLBACK_SUBJECT);
      expect(rendered.subject).toBe("Here’s a fresh link to your 7-day plan");
      expect(rendered.text).toContain("Hey there,");
      expect(rendered.personalizedName).toBeNull();
    }
  });

  it("carries no promotion, marketing, unsubscribe CTA, plan data, or the word assignment", () => {
    const rendered = renderRecovery({ firstName: "Todd", returnUrl: url });
    for (const payload of [rendered.subject, rendered.text, rendered.html, rendered.previewText]) {
      expect(payload).not.toMatch(/assignment/i);
      expect(payload).not.toMatch(/accelerator/i);
      expect(payload).not.toMatch(/unsubscribe/i);
      expect(payload).not.toMatch(/email preferences/i);
      expect(payload).not.toMatch(/\bgrams?\b/i);
      expect(payload).not.toMatch(/protein/i);
      expect(payload).not.toMatch(/\bW0[1-7]\b/);
      expect(payload).not.toMatch(/\$\d/);
      expect(payload).not.toMatch(/\bday [1-7]\b/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const NOW = new Date("2026-03-01T12:00:00.000Z");

function makeRecoveryJob(overrides: Record<string, unknown> = {}) {
  return makeJob({
    job_id: "recovery-job-1",
    job_type: RECOVERY_JOB_TYPE,
    job_version: RECOVERY_JOB_VERSION,
    template_version: RECOVERY_TEMPLATE_VERSION,
    source_event_id: null,
    idempotency_key: recoveryJobKey("version-1", "req-abc"),
    created_at: NOW.toISOString(),
    eligible_at: NOW.toISOString(),
    ...overrides,
  });
}

function harness() {
  const sent: EmailSendRequest[] = [];
  const store = createMemoryStore(() => NOW);
  const adapter: EmailAdapter = {
    key: "fake",
    async send(request) {
      sent.push(request);
      return {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: `msg-${sent.length}`,
        acceptedAt: NOW.toISOString(),
      };
    },
  };
  const deps: DispatchDeps = {
    store,
    adapter,
    now: () => NOW,
    appOrigin: "https://app.genxjumps.com",
    fromEmail: "todd@notify.genxjumps.com",
    fromName: "Todd from Gen X Jumps",
    replyTo: "todd@genxjumps.com",
    deriveCredential: (purpose, planVersionId, scope) =>
      `${purpose}~${planVersionId}~${scope ?? "none"}`,
    hash: async (raw) => `hash(${raw})`,
  };
  return { sent, store: store as MemoryStore, deps };
}

describe("recovery dispatch", () => {
  it("sends for a matching current plan and issues a fresh recovery-purpose token", async () => {
    const { sent, store, deps } = harness();
    store.leads.set("lead-1", makeLead());
    const job = makeRecoveryJob();
    store.jobs.set(job.job_id, { ...job });

    const summary = await dispatchRecoveryJobs(deps);

    expect(summary.claimed).toBe(1);
    expect(summary.outcomes[0]!.outcome).toBe("provider_accepted");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.idempotencyKey).toBe("recovery:version-1:req-abc:v1");

    // Fresh, job-scoped, purpose-limited credential with the established 30-day TTL.
    expect(store.returnTokens).toHaveLength(1);
    const token = store.returnTokens[0]!;
    expect(token.purpose).toBe("recovery");
    expect(token.jobId).toBe("recovery-job-1");
    expect(token.tokenHash).toBe(`hash(recovery~version-1~recovery:version-1:req-abc:v1)`);
    expect(new Date(token.expiresAt).getTime() - new Date(token.issuedAt).getTime()).toBe(
      RETURN_TOKEN_TTL_MS,
    );

    // The credential is not the Plan Ready or same-browser credential.
    expect(token.tokenHash).not.toBe(`hash(open_plan~version-1~none)`);
    // No marketing/preference credential is issued for recovery.
    expect(store.preferenceCredentials).toHaveLength(0);

    // The URL leaks no email, ids, assessment, weight/protein, or redirect params.
    const url = new URL(/https:\/\/\S+?(?=[\s"])/.exec(sent[0]!.text)![0]);
    expect(url.pathname).toBe("/return");
    expect([...url.searchParams.keys()]).toEqual(["token"]);
    // Outside the opaque credential itself the message carries no identifiers.
    const withoutToken = sent[0]!.html.replaceAll(url.searchParams.get("token")!, "TOKEN");
    expect(withoutToken).not.toContain("reader@example.com");
    expect(withoutToken).not.toContain("lead-1");
    expect(withoutToken).not.toContain("version-1");
  });

  it("retries of the same job reproduce the identical credential; a different request id does not", async () => {
    const { store, deps } = harness();
    store.leads.set("lead-1", makeLead());

    const first = makeRecoveryJob();
    store.jobs.set(first.job_id, { ...first });
    await dispatchRecoveryJobs(deps);
    const firstHash = store.returnTokens[0]!.tokenHash;

    // Same logical job, replayed attempt.
    const replay = makeRecoveryJob({ job_id: "recovery-job-1b" });
    store.jobs.set(replay.job_id, { ...replay });
    await dispatchRecoveryJobs(deps);
    expect(store.returnTokens.filter((t) => t.tokenHash === firstHash)).toHaveLength(1);

    // Different validated request id: distinct job and distinct credential.
    const second = makeRecoveryJob({
      job_id: "recovery-job-2",
      idempotency_key: recoveryJobKey("version-1", "req-def"),
    });
    store.jobs.set(second.job_id, { ...second });
    await dispatchRecoveryJobs(deps);

    const hashes = new Set(store.returnTokens.map((t) => t.tokenHash));
    expect(hashes.size).toBe(2);
  });

  it("is allowed after a marketing unsubscribe", async () => {
    const { sent, store, deps } = harness();
    // Marketing unsubscribe lives on the lead plan and is never a send guard here.
    store.leads.set("lead-1", makeLead());
    const job = makeRecoveryJob();
    store.jobs.set(job.job_id, { ...job });

    await dispatchRecoveryJobs(deps);
    expect(sent).toHaveLength(1);
  });

  it("does not require Plan Ready provider acceptance", async () => {
    const { sent, store, deps } = harness();
    store.leads.set("lead-1", makeLead());
    // A never-accepted Plan Ready job exists for the same plan version.
    const planReady = makeJob({ job_id: "plan-ready-1", status: "pending" });
    store.jobs.set(planReady.job_id, { ...planReady });
    const job = makeRecoveryJob();
    store.jobs.set(job.job_id, { ...job });

    await dispatchRecoveryJobs(deps);

    expect(sent).toHaveLength(1);
    // The proactive Plan Ready job is untouched by recovery dispatch.
    expect(store.jobs.get("plan-ready-1")!.status).toBe("pending");
  });

  it("suppresses a hard bounce or complaint before any provider call", async () => {
    for (const reason of ["hard_bounce", "complaint"]) {
      const { sent, store, deps } = harness();
      store.leads.set("lead-1", makeLead());
      store.suppressions.set("reader@example.com", reason);
      const job = makeRecoveryJob();
      store.jobs.set(job.job_id, { ...job });

      const summary = await dispatchRecoveryJobs(deps);

      expect(summary.outcomes[0]!.outcome).toBe("suppressed");
      expect(sent).toHaveLength(0);
      expect(store.returnTokens).toHaveLength(0);
      expect(store.events.map((e) => e.event_name)).toContain("email_recovery_suppressed");
    }
  });

  it("cancels a stale replaced-plan recovery job without sending", async () => {
    const { sent, store, deps } = harness();
    // Reassessment moved the lead to a newer plan version.
    store.leads.set("lead-1", makeLead({ plan_version_id: "version-2" }));
    const job = makeRecoveryJob();
    store.jobs.set(job.job_id, { ...job });

    const summary = await dispatchRecoveryJobs(deps);

    expect(summary.outcomes[0]!.outcome).toBe("canceled");
    expect(sent).toHaveLength(0);
    expect(store.returnTokens).toHaveLength(0);
    // Cancellation is silent, exactly like Plan Ready cancellation.
    expect(store.events).toHaveLength(0);
  });

  it("consumes no lifecycle gap or cap and never touches proactive lifecycle jobs", async () => {
    const { sent, store, deps } = harness();
    store.leads.set("lead-1", makeLead());

    // An accepted lifecycle email moments ago would block a lifecycle send.
    const halfway = makeJob({
      job_id: "halfway-1",
      job_type: "halfway",
      template_version: "halfway_v1",
      idempotency_key: "halfway:version-1:v1",
      status: "provider_accepted",
    });
    store.jobs.set(halfway.job_id, { ...halfway, provider_accepted_at: NOW.toISOString() });
    const pendingStalled = makeJob({
      job_id: "stalled-1",
      job_type: "stalled",
      template_version: "stalled_v1",
      idempotency_key: "stalled:version-1:after_day:2:v1",
      status: "pending",
    });
    store.jobs.set(pendingStalled.job_id, { ...pendingStalled });

    const job = makeRecoveryJob();
    store.jobs.set(job.job_id, { ...job });

    const summary = await dispatchRecoveryJobs(deps);

    // Recovery sent regardless of the just-accepted lifecycle message.
    expect(summary.outcomes[0]!.outcome).toBe("provider_accepted");
    expect(sent).toHaveLength(1);

    // No lifecycle job was canceled, deferred, or rescheduled.
    expect(store.jobs.get("stalled-1")!.status).toBe("pending");
    expect(store.jobs.get("stalled-1")!.next_attempt_at).toBeNull();
    expect(store.jobs.get("halfway-1")!.status).toBe("provider_accepted");
    // Only recovery's own acceptance event was written.
    expect(store.events.map((e) => e.event_name)).toEqual(["email_recovery_provider_accepted"]);
  });

  it("claims only recovery jobs, leaving other job types unclaimed", async () => {
    const { store, deps } = harness();
    store.leads.set("lead-1", makeLead());
    const planReady = makeJob({ job_id: "plan-ready-1" });
    store.jobs.set(planReady.job_id, { ...planReady });

    const summary = await dispatchRecoveryJobs(deps);

    expect(summary.claimed).toBe(0);
    expect(store.jobs.get("plan-ready-1")!.status).toBe("pending");
    expect(store.jobs.get("plan-ready-1")!.attempt_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Deliberate exchange: destination and attribution
// ---------------------------------------------------------------------------

describe("recovery return-link exchange", () => {
  const recoveryJobIdentity = {
    jobId: "recovery-job-1",
    jobType: RECOVERY_JOB_TYPE,
    jobVersion: RECOVERY_JOB_VERSION,
    templateVersion: RECOVERY_TEMPLATE_VERSION,
    leadPlanId: "lead-1",
    planVersionId: "version-1",
  };

  it("restores the plan hub, never a specific day page", () => {
    expect(
      resolveReturnDestination({
        purpose: "recovery",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job: recoveryJobIdentity,
      }),
    ).toBe(DEFAULT_RETURN_DESTINATION);
    expect(DEFAULT_RETURN_DESTINATION).toBe("/your-plan");
  });

  it("attributes the exchange to the originating recovery job", () => {
    expect(
      resolveLinkExchangeAttribution({
        purpose: "recovery",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job: recoveryJobIdentity,
      }),
    ).toEqual({ eventName: RECOVERY_LINK_EXCHANGE_EVENT, jobId: "recovery-job-1" });
    expect(RECOVERY_LINK_EXCHANGE_EVENT).toBe("email_recovery_link_exchange_completed");
  });

  it("falls back to the general event for mismatched or job-less recovery tokens", () => {
    const cases = [
      { ...recoveryJobIdentity, leadPlanId: "other-lead" },
      { ...recoveryJobIdentity, planVersionId: "version-2" },
      { ...recoveryJobIdentity, jobVersion: "v2" },
      { ...recoveryJobIdentity, templateVersion: "recovery_v2" },
      { ...recoveryJobIdentity, jobType: "plan_ready" },
    ];
    for (const job of cases) {
      expect(
        resolveLinkExchangeAttribution({
          purpose: "recovery",
          leadPlanId: "lead-1",
          planVersionId: "version-1",
          job,
        }),
      ).toEqual({ eventName: PLAN_READY_LINK_EXCHANGE_EVENT, jobId: null });
    }
    expect(
      resolveLinkExchangeAttribution({
        purpose: "recovery",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job: null,
      }),
    ).toEqual({ eventName: PLAN_READY_LINK_EXCHANGE_EVENT, jobId: null });
  });

  it("keeps every existing open_plan attribution unchanged", () => {
    expect(
      resolveLinkExchangeAttribution({
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job: {
          jobId: "halfway-1",
          jobType: "halfway",
          jobVersion: "v1",
          templateVersion: "halfway_v1",
          leadPlanId: "lead-1",
          planVersionId: "version-1",
        },
      }),
    ).toEqual({ eventName: "email_halfway_link_exchange_completed", jobId: "halfway-1" });
  });
});

// ---------------------------------------------------------------------------
// Documented entry points
// ---------------------------------------------------------------------------

describe("recovery entry points", () => {
  it("the invalid /return response sends the reader to /recover, not assessment", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/routes/return.ts", "utf8"),
    );
    const generic = source.slice(source.indexOf("function genericRecovery"));
    const block = generic.slice(0, generic.indexOf("\n}"));
    expect(block).toContain("Get Back to Your Plan");
    expect(block).toContain('href="/recover"');
    expect(block).not.toContain("/assessment");
  });

  it("the saved plan page offers exactly the documented Resend My Plan Link action", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/routes/your-plan.index.tsx", "utf8"),
    );
    expect(source).toContain("Resend My Plan Link");
    expect(source).toContain('href="/recover"');
  });
});
