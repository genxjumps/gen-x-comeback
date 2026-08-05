// Tests for the Plan Ready correction pass: lease fencing, the idempotency
// horizon, stable derived credentials, early-webhook reconciliation, and the
// hardened public HTML responses. Deterministic: no provider, database, or network.
import { describe, expect, it, vi } from "vitest";

import { dispatchPlanReadyJobs, type DispatchDeps } from "@/lib/email/dispatch";
import { deriveEmailCredential } from "@/lib/email/credentials.server";
import { IDEMPOTENCY_HORIZON_MS, type EmailAdapter, type EmailSendResult } from "@/lib/email/types";
import { RAW_TOKEN_RE } from "@/lib/lead-plan";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";

vi.mock("@/lib/email/rate-limit.server", () => ({
  callerBucketKey: () => "test-bucket",
  consumeRateLimit: async () => ({ allowed: true }),
}));


const FIXED_NOW = new Date("2026-02-01T12:00:00.000Z");

function scriptedAdapter(results: EmailSendResult[]) {
  const sent: Array<Parameters<EmailAdapter["send"]>[0]> = [];
  let index = 0;
  const adapter: EmailAdapter = {
    key: "fake",
    send: async (request) => {
      sent.push(request);
      const result = results[Math.min(index, results.length - 1)]!;
      index += 1;
      return result;
    },
  };
  return { adapter, sent };
}

function makeDeps(store: MemoryStore, adapter: EmailAdapter): DispatchDeps {
  return {
    store,
    adapter,
    now: () => FIXED_NOW,
    appOrigin: "https://app.genxjumps.com",
    fromEmail: "todd@notify.genxjumps.com",
    fromName: "Todd from Gen X Jumps",
    replyTo: "todd@genxjumps.com",
    deriveCredential: (purpose, planVersionId) =>
      deriveEmailCredential("test-secret-value-0123456789abcdef", purpose, planVersionId),
    hash: async (raw) => `hash:${raw}`,
  };
}

function seed(job = makeJob()) {
  const store = createMemoryStore(() => FIXED_NOW);
  store.leads.set("lead-1", makeLead());
  store.jobs.set(job.job_id, { ...job });
  return store;
}

const ACCEPTED: EmailSendResult = {
  outcome: "accepted",
  providerKey: "fake",
  providerMessageId: "pm_1",
  acceptedAt: FIXED_NOW.toISOString(),
};

describe("derived email credentials", () => {
  const secret = "test-secret-value-0123456789abcdef";

  it("is deterministic for one purpose and plan version", () => {
    expect(deriveEmailCredential(secret, "open_plan", "version-1")).toBe(
      deriveEmailCredential(secret, "open_plan", "version-1"),
    );
  });

  it("separates purposes, plan versions, and secrets", () => {
    const a = deriveEmailCredential(secret, "open_plan", "version-1");
    expect(a).not.toBe(deriveEmailCredential(secret, "email_preferences", "version-1"));
    expect(a).not.toBe(deriveEmailCredential(secret, "open_plan", "version-2"));
    expect(a).not.toBe(deriveEmailCredential(`${secret}x`, "open_plan", "version-1"));
  });

  it("uses the opaque token format the app already validates", () => {
    expect(RAW_TOKEN_RE.test(deriveEmailCredential(secret, "open_plan", "version-1"))).toBe(true);
  });

  it("gives a retried attempt the same return credential, never a second live one", async () => {
    const store = seed();
    const transient = scriptedAdapter([{ outcome: "transient", errorCode: "timeout" }]);
    await dispatchPlanReadyJobs(makeDeps(store, transient.adapter));

    const job = store.jobs.get("job-1")!;
    job.status = "retry_scheduled";
    job.next_attempt_at = null;
    const retry = scriptedAdapter([ACCEPTED]);
    await dispatchPlanReadyJobs(makeDeps(store, retry.adapter));

    expect(store.jobs.get("job-1")?.status).toBe("provider_accepted");
    // One credential row, reused, not two live tokens for one reader.
    expect(store.returnTokens).toHaveLength(1);
    expect(store.preferenceCredentials).toHaveLength(1);
  });
});

describe("lease fencing", () => {
  it("discards the result of a worker that lost its lease", async () => {
    const store = seed();
    const fenced: EmailAdapter = {
      key: "fake",
      send: async () => {
        // Another worker takes the lease mid-attempt.
        store.stealLease("job-1");
        return ACCEPTED;
      },
    };

    const summary = await dispatchPlanReadyJobs(makeDeps(store, fenced));
    expect(summary.outcomes[0]?.outcome).toBe("lost_lease");

    const job = store.jobs.get("job-1")!;
    // The fenced worker wrote no terminal state, no provider id, and no event.
    expect(job.status).toBe("processing");
    expect(job.provider_message_id ?? null).toBeNull();
    expect(store.events).toHaveLength(0);
  });
});

describe("idempotency horizon", () => {
  it("routes a job older than 24 hours to manual review without any send", async () => {
    const store = seed(
      makeJob({
        created_at: new Date(FIXED_NOW.getTime() - IDEMPOTENCY_HORIZON_MS - 1_000).toISOString(),
      }),
    );
    const { adapter, sent } = scriptedAdapter([ACCEPTED]);

    const summary = await dispatchPlanReadyJobs(makeDeps(store, adapter));
    expect(summary.outcomes[0]?.outcome).toBe("manual_review");
    expect(sent).toHaveLength(0);

    const job = store.jobs.get("job-1")!;
    expect(job.status).toBe("failed_permanent");
    expect(job.manual_review_at).toBe(FIXED_NOW.toISOString());
    expect(job.last_error_code).toBe("idempotency_horizon_exceeded");
    expect(store.alerts.some((a) => a.alert_type === "plan_ready_manual_review_required")).toBe(
      true,
    );
  });

  it("still sends a job created inside the horizon", async () => {
    const store = seed(
      makeJob({
        created_at: new Date(FIXED_NOW.getTime() - IDEMPOTENCY_HORIZON_MS + 60_000).toISOString(),
      }),
    );
    const { adapter, sent } = scriptedAdapter([ACCEPTED]);
    await dispatchPlanReadyJobs(makeDeps(store, adapter));
    expect(sent).toHaveLength(1);
    expect(store.jobs.get("job-1")?.status).toBe("provider_accepted");
  });
});

describe("early provider events", () => {
  it("applies a delivery event that arrived before the message id was known", async () => {
    const store = seed();
    store.providerEvents.push({
      id: "pe-1",
      provider_key: "fake",
      provider_message_id: "pm_1",
      event_kind: "delivered",
      occurred_at: FIXED_NOW.toISOString(),
      job_id: null,
      reconciled_at: null,
    });

    await dispatchPlanReadyJobs(makeDeps(store, scriptedAdapter([ACCEPTED]).adapter));

    const job = store.jobs.get("job-1")!;
    expect(job.delivery_status).toBe("delivered");
    expect(store.providerEvents[0]?.reconciled_at).not.toBeNull();
    expect(store.providerEvents[0]?.job_id).toBe("job-1");
    expect(store.events.some((e) => e.event_name === "email_plan_ready_delivered")).toBe(true);
  });

  it("never regresses a terminal delivery state with a late event", async () => {
    const store = seed();
    await dispatchPlanReadyJobs(makeDeps(store, scriptedAdapter([ACCEPTED]).adapter));
    expect(await store.applyDeliveryEvent("job-1", "delivered", FIXED_NOW.toISOString())).toBe(
      true,
    );
    // A stale delayed event after delivery is rejected outright.
    expect(await store.applyDeliveryEvent("job-1", "delayed", FIXED_NOW.toISOString())).toBe(false);
    expect(store.jobs.get("job-1")?.delivery_status).toBe("delivered");
  });
});

type Handler = (ctx: { request: Request }) => Promise<Response>;

async function getHandler(path: "return" | "email-preferences"): Promise<Handler> {
  const mod =
    path === "return"
      ? await import("@/routes/return")
      : await import("@/routes/email-preferences");
  const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
  const server = options["server"] as { handlers: Record<string, Handler> };
  return server.handlers["GET"]!;
}

describe("public HTML response hardening", () => {
  it("serves /return with a script-free content security policy", async () => {
    const handler = await getHandler("return");
    const res = await handler({
      request: new Request("https://app.genxjumps.com/return?token=abc"),
    });
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("script-src 'self'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");

    const html = await res.text();
    expect(html).not.toContain("<script");
    expect(html).toContain('type="submit"');
  });
});
