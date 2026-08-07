// Plan Ready job-correlation repair. Proves the Plan Ready return credential is
// job-associated (stable per logical job, distinct per job/plan version) and that
// a completed exchange of that token correlates to the originating Plan Ready job.
// Deterministic: in-memory store, fake adapter, fixed clock, no network.
import { describe, expect, it } from "vitest";

import { dispatchPlanReadyJobs, type DispatchDeps } from "@/lib/email/dispatch";
import {
  deriveEmailCredential,
  type CredentialPurpose,
} from "@/lib/email/credentials.server";
import {
  PLAN_READY_LINK_EXCHANGE_EVENT,
  resolveLinkExchangeAttribution,
} from "@/lib/email/link-exchange-event";
import {
  PLAN_READY_JOB_TYPE,
  PLAN_READY_JOB_VERSION,
  PLAN_READY_TEMPLATE_VERSION,
  type EmailAdapter,
} from "@/lib/email/types";
import { resolveReturnDestination } from "@/lib/email/return-destination";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";

const NOW = new Date("2026-02-01T12:00:00.000Z");
const SECRET = "x".repeat(48);

function fakeAdapter() {
  const requests: Array<Parameters<EmailAdapter["send"]>[0]> = [];
  const adapter: EmailAdapter = {
    key: "fake",
    send: async (request) => {
      requests.push(request);
      return {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: "pm_corr",
        acceptedAt: NOW.toISOString(),
      };
    },
  };
  return { adapter, requests };
}

function deps(store: MemoryStore, adapter: EmailAdapter): DispatchDeps {
  return {
    store,
    adapter,
    now: () => NOW,
    appOrigin: "https://app.genxjumps.com",
    fromEmail: "todd@notify.genxjumps.com",
    fromName: "Todd from Gen X Jumps",
    replyTo: "todd@genxjumps.com",
    // Real derivation, so scoping behaviour is proven rather than simulated.
    deriveCredential: (purpose: CredentialPurpose, planVersionId: string, scope?: string) =>
      deriveEmailCredential(SECRET, purpose, planVersionId, scope),
    hash: async (raw) => `hash:${raw}`,
  };
}

function harness(job = makeJob(), lead = makeLead()) {
  const store = createMemoryStore(() => NOW);
  store.leads.set(lead.id, lead);
  store.jobs.set(job.job_id, { ...job });
  const { adapter, requests } = fakeAdapter();
  return { store, adapter, requests, deps: deps(store, adapter), job, lead };
}

describe("Plan Ready return credential is job-associated", () => {
  it("stores the originating Plan Ready job id on the return token", async () => {
    const h = harness();
    await dispatchPlanReadyJobs(h.deps);

    expect(h.store.returnTokens).toHaveLength(1);
    const token = h.store.returnTokens[0]!;
    expect(token.jobId).toBe("job-1");
    expect(token.leadPlanId).toBe("lead-1");
    expect(token.planVersionId).toBe("version-1");
    // Only hashes are persisted.
    expect(token.tokenHash.startsWith("hash:")).toBe(true);
  });

  it("derives an identical credential when the same logical job is retried", async () => {
    const first = harness();
    await dispatchPlanReadyJobs(first.deps);
    const second = harness();
    await dispatchPlanReadyJobs(second.deps);

    expect(second.store.returnTokens[0]?.tokenHash).toBe(first.store.returnTokens[0]?.tokenHash);
  });

  it("derives a different credential for a different job or plan version", async () => {
    const base = harness();
    await dispatchPlanReadyJobs(base.deps);
    const baseHash = base.store.returnTokens[0]!.tokenHash;

    const otherJob = harness(
      makeJob({ job_id: "job-2", idempotency_key: "plan_ready:version-1:v1:retry" }),
    );
    await dispatchPlanReadyJobs(otherJob.deps);
    expect(otherJob.store.returnTokens[0]!.tokenHash).not.toBe(baseHash);

    const otherVersion = harness(
      makeJob({ plan_version_id: "version-2", idempotency_key: "plan_ready:version-2:v1" }),
      makeLead({ plan_version_id: "version-2" }),
    );
    await dispatchPlanReadyJobs(otherVersion.deps);
    expect(otherVersion.store.returnTokens[0]!.tokenHash).not.toBe(baseHash);
  });

  it("keeps the preference credential plan-scoped and the sent payload otherwise unchanged", async () => {
    const h = harness();
    await dispatchPlanReadyJobs(h.deps);

    expect(h.store.preferenceCredentials[0]?.tokenHash).toBe(
      `hash:${deriveEmailCredential(SECRET, "email_preferences", "version-1")}`,
    );
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]!.idempotencyKey).toBe("plan_ready:version-1:v1");
    expect(h.requests[0]!.subject).toBe("Todd, your 7-Day Comeback Plan is Ready");
  });
});

describe("Plan Ready exchange attribution and destination", () => {
  const job = {
    jobId: "job-1",
    jobType: PLAN_READY_JOB_TYPE,
    jobVersion: PLAN_READY_JOB_VERSION,
    templateVersion: PLAN_READY_TEMPLATE_VERSION,
    leadPlanId: "lead-1",
    planVersionId: "version-1",
  };

  it("correlates the Plan Ready exchange event to the originating job id", () => {
    const attribution = resolveLinkExchangeAttribution({
      purpose: "open_plan",
      leadPlanId: "lead-1",
      planVersionId: "version-1",
      job,
    });
    expect(attribution.eventName).toBe(PLAN_READY_LINK_EXCHANGE_EVENT);
    expect(attribution.jobId).toBe("job-1");
  });

  it("keeps a job-less or foreign-owned Plan Ready token on the general uncorrelated event", () => {
    for (const candidate of [
      null,
      { ...job, leadPlanId: "lead-9" },
      { ...job, planVersionId: "version-9" },
      { ...job, jobId: null },
    ]) {
      const attribution = resolveLinkExchangeAttribution({
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job: candidate,
      });
      expect(attribution.eventName).toBe(PLAN_READY_LINK_EXCHANGE_EVENT);
      expect(attribution.jobId).toBeNull();
    }
  });

  it("keeps the clean Plan Ready destination at /your-plan", () => {
    expect(
      resolveReturnDestination({
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job,
      }),
    ).toBe("/your-plan");
  });
});
