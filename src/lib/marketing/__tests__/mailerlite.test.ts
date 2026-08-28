import { afterEach, describe, expect, it, vi } from "vitest";

import { evaluateMarketingSyncGate } from "@/lib/marketing/config.server";
import { dispatchMarketingSyncJobs } from "@/lib/marketing/dispatch";
import { createMailerLiteAdapter } from "@/lib/marketing/mailerlite.server";
import type {
  MarketingLead,
  MarketingSyncFence,
  MarketingSyncJob,
  MarketingSyncStore,
} from "@/lib/marketing/types";

const NOW = new Date("2026-08-28T15:00:00.000Z");

function makeJob(patch: Partial<MarketingSyncJob> = {}): MarketingSyncJob {
  return {
    job_id: "job-1",
    lead_plan_id: "lead-1",
    consent_at: "2026-08-28T14:00:00.000Z",
    status: "processing",
    attempt_count: 1,
    claim_token: "11111111-1111-4111-8111-111111111111",
    ...patch,
  };
}

function makeLead(): MarketingLead {
  return {
    id: "lead-1",
    email_normalized: "jason@example.com",
    first_name: "Jason",
    marketing_consent_active: true,
    marketing_consent_at: "2026-08-28T14:00:00.000Z",
    email_suppressed_at: null,
  };
}

function memoryStore(options?: { fence?: MarketingSyncFence }) {
  const jobs = [makeJob()];
  const finishes: Array<Record<string, unknown>> = [];
  const store: MarketingSyncStore = {
    claimJobs: async () => jobs,
    getLead: async () => makeLead(),
    beginAttempt: async () => options?.fence ?? "ok",
    finish: async (job, input) => {
      finishes.push({ jobId: job.job_id, ...input });
      return true;
    },
  };
  return { store, finishes };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MailerLite activation gate", () => {
  it("stays disabled unless explicitly enabled", () => {
    expect(
      evaluateMarketingSyncGate({ enabled: false, apiToken: "token", groupId: "123" }),
    ).toEqual({ enabled: false, reason: "disabled", missing: [] });
  });

  it("fails closed when an enabled deployment lacks a valid token or group", () => {
    expect(
      evaluateMarketingSyncGate({ enabled: true, apiToken: null, groupId: "not-an-id" }),
    ).toEqual({
      enabled: false,
      reason: "missing_configuration",
      missing: ["MAILERLITE_API_TOKEN", "MAILERLITE_GROUP_ID"],
    });
  });
});

describe("MailerLite adapter", () => {
  it("sends only contact, consent, and group data and never forces resubscribe", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(JSON.stringify({ data: { id: "subscriber-1", status: "active" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await createMailerLiteAdapter(
      "secret",
      fetchImpl as typeof fetch,
    ).upsertSubscriber({
      email: "jason@example.com",
      firstName: "Jason",
      groupId: "123456",
      consentAt: "2026-08-28T14:00:00.000Z",
    });

    expect(result).toEqual({
      outcome: "accepted",
      subscriberId: "subscriber-1",
      subscriberStatus: "active",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.input).toBe("https://connect.mailerlite.com/api/subscribers");
    const body = JSON.parse(String(requests[0]!.init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      email: "jason@example.com",
      fields: { name: "Jason" },
      groups: ["123456"],
      opted_in_at: "2026-08-28 14:00:00",
    });
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("resubscribe");
    for (const forbidden of ["assessment", "weight", "protein", "plan", "progress"]) {
      expect(JSON.stringify(body).toLowerCase()).not.toContain(forbidden);
    }
  });

  it("honors MailerLite retry-after guidance", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("rate limited", { status: 429, headers: { "retry-after": "119" } }),
    );
    const result = await createMailerLiteAdapter(
      "secret",
      fetchImpl as typeof fetch,
    ).upsertSubscriber({
      email: "jason@example.com",
      firstName: "Jason",
      groupId: "123456",
      consentAt: "2026-08-28T14:00:00.000Z",
    });
    expect(result).toEqual({ outcome: "retry", errorCode: "http_429", retryAfterMs: 119_000 });
  });
});

describe("marketing sync dispatch", () => {
  it("upserts a consented lead and records the subscriber id", async () => {
    const h = memoryStore();
    const requests: unknown[] = [];
    const summary = await dispatchMarketingSyncJobs({
      store: h.store,
      groupId: "123456",
      now: () => NOW,
      adapter: {
        key: "mailerlite",
        upsertSubscriber: async (request) => {
          requests.push(request);
          return { outcome: "accepted", subscriberId: "subscriber-1", subscriberStatus: "active" };
        },
      },
    });

    expect(summary).toEqual({ claimed: 1, accepted: 1, retried: 0, failed: 0, suppressed: 0 });
    expect(requests).toEqual([
      {
        email: "jason@example.com",
        firstName: "Jason",
        groupId: "123456",
        consentAt: "2026-08-28T14:00:00.000Z",
      },
    ]);
    expect(h.finishes).toEqual([
      {
        jobId: "job-1",
        status: "provider_accepted",
        subscriberId: "subscriber-1",
        acceptedAt: NOW.toISOString(),
      },
    ]);
  });

  it("makes no provider call when the final consent fence closes", async () => {
    const h = memoryStore({ fence: "consent_blocked" });
    const provider = vi.fn();
    const summary = await dispatchMarketingSyncJobs({
      store: h.store,
      groupId: "123456",
      now: () => NOW,
      adapter: { key: "mailerlite", upsertSubscriber: provider },
    });

    expect(provider).not.toHaveBeenCalled();
    expect(summary.suppressed).toBe(1);
    expect(h.finishes[0]).toMatchObject({
      status: "suppressed",
      errorCode: "consent_blocked",
    });
  });

  it("retries transient provider failures without blocking the lead flow", async () => {
    const h = memoryStore();
    const summary = await dispatchMarketingSyncJobs({
      store: h.store,
      groupId: "123456",
      now: () => NOW,
      adapter: {
        key: "mailerlite",
        upsertSubscriber: async () => ({ outcome: "retry", errorCode: "http_503" }),
      },
    });

    expect(summary.retried).toBe(1);
    expect(h.finishes[0]).toMatchObject({
      status: "retry_scheduled",
      errorCode: "http_503",
      nextAttemptAt: "2026-08-28T15:05:00.000Z",
    });
  });
});
