import { afterEach, describe, expect, it, vi } from "vitest";

import { dispatchMarketingSyncJobs } from "@/lib/marketing/dispatch";
import {
  createMailerLiteEdgeAdapter,
  readMailerLiteEdgeGate,
} from "@/lib/marketing/mailerlite-edge.server";
import type {
  MarketingLead,
  MarketingSyncFence,
  MarketingSyncJob,
  MarketingSyncStore,
} from "@/lib/marketing/types";

const NOW = new Date("2026-08-28T15:00:00.000Z");
const EDGE_CONFIG = {
  endpoint: "https://project.supabase.co/functions/v1/mailerlite-marketing-sync",
  serviceRoleKey: "service-role-secret",
};

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

describe("MailerLite Edge Function client", () => {
  it("reads the fail-closed activation gate without exposing secret values", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        enabled: false,
        reason: "disabled",
        missing: [],
        configuration: {
          enable_flag_present: true,
          api_token_present: true,
          group_id_present: true,
          group_id_valid: true,
        },
      }),
    );
    const result = await readMailerLiteEdgeGate(EDGE_CONFIG, fetchImpl as typeof fetch);
    expect(result).toEqual({
      enabled: false,
      reason: "disabled",
      missing: [],
      configuration: {
        enable_flag_present: true,
        api_token_present: true,
        group_id_present: true,
        group_id_valid: true,
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      EDGE_CONFIG.endpoint,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: `Bearer ${EDGE_CONFIG.serviceRoleKey}`,
        }),
        body: JSON.stringify({ action: "status" }),
      }),
    );
  });

  it("fails closed when the Edge Function is unavailable", async () => {
    const fetchImpl = vi.fn(async () => new Response("not found", { status: 404 }));
    await expect(readMailerLiteEdgeGate(EDGE_CONFIG, fetchImpl as typeof fetch)).resolves.toEqual({
      enabled: false,
      reason: "edge_unavailable",
      missing: [],
    });
  });

  it("sends only the approved contact fields to the internal Edge Function", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return Response.json({
        outcome: "accepted",
        subscriberId: "subscriber-1",
        subscriberStatus: "active",
      });
    });

    const result = await createMailerLiteEdgeAdapter(
      EDGE_CONFIG,
      fetchImpl as typeof fetch,
    ).upsertSubscriber({
      email: "jason@example.com",
      firstName: "Jason",
      groupId: "must-not-cross-the-edge-boundary",
      consentAt: "2026-08-28T14:00:00.000Z",
    });

    expect(result).toEqual({
      outcome: "accepted",
      subscriberId: "subscriber-1",
      subscriberStatus: "active",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.input).toBe(EDGE_CONFIG.endpoint);
    const body = JSON.parse(String(requests[0]!.init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      action: "upsert",
      subscriber: {
        email: "jason@example.com",
        firstName: "Jason",
        consentAt: "2026-08-28T14:00:00.000Z",
      },
    });
    for (const forbidden of ["groupId", "assessment", "weight", "protein", "plan", "progress"]) {
      expect(JSON.stringify(body).toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("turns an unavailable Edge Function into a retry", async () => {
    const fetchImpl = vi.fn(async () => new Response("unavailable", { status: 503 }));
    const result = await createMailerLiteEdgeAdapter(
      EDGE_CONFIG,
      fetchImpl as typeof fetch,
    ).upsertSubscriber({
      email: "jason@example.com",
      firstName: "Jason",
      groupId: "123456",
      consentAt: "2026-08-28T14:00:00.000Z",
    });
    expect(result).toEqual({ outcome: "retry", errorCode: "edge_http_503" });
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
