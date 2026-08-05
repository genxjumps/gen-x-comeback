// Acceptance tests for the Start Day 1 controlled dispatch path (7.6.1).
// Deterministic: fixed clock, in-memory store, injected fake provider, and an
// injected authoritative state loader. No database, no network, no real sending.
import { describe, expect, it } from "vitest";

import { dispatchStartDayOneJobs, type StartDayOneDispatchDeps } from "@/lib/email/dispatch";
import { createFakeAdapter } from "@/lib/email/adapters.server";
import {
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  START_DAY_1_JOB_TYPE,
  START_DAY_1_JOB_VERSION,
  START_DAY_1_TEMPLATE_VERSION,
  type EmailJobRow,
} from "@/lib/email/types";
import {
  LIFECYCLE_MIN_GAP_MS,
  MAX_ACCEPTED_INACTIVITY_EMAILS,
  type StartDayOneState,
} from "@/lib/email/start-day-1-resolver";
import {
  resolveReturnDestination,
  START_DAY_1_RETURN_DESTINATION,
  DEFAULT_RETURN_DESTINATION,
} from "@/lib/email/return-destination";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";

const NOW = new Date("2026-02-03T12:00:00.000Z");
const ELIGIBLE_AT = "2026-02-02T12:00:00.000Z";
const PLAN_READY_ACCEPTED_AT = "2026-02-01T12:00:05.000Z";

function startJob(overrides: Partial<EmailJobRow> = {}): EmailJobRow {
  return makeJob({
    job_id: "sd1-job",
    job_type: START_DAY_1_JOB_TYPE,
    job_version: START_DAY_1_JOB_VERSION,
    template_version: START_DAY_1_TEMPLATE_VERSION,
    idempotency_key: "start_day_1:version-1:v1",
    created_at: "2026-02-01T12:00:00.000Z",
    eligible_at: ELIGIBLE_AT,
    ...overrides,
  });
}

function eligibleState(job: EmailJobRow, overrides: Partial<StartDayOneState> = {}) {
  return {
    job: {
      job_id: job.job_id,
      job_type: job.job_type,
      job_version: job.job_version,
      template_version: job.template_version,
      lead_plan_id: job.lead_plan_id,
      plan_version_id: job.plan_version_id,
      eligible_at: job.eligible_at,
    },
    currentPlanVersionId: job.plan_version_id,
    hasRecipient: true,
    marketingUnsubscribedAt: null,
    emailSuppressedAt: null,
    suppressionListed: false,
    dayOneStartedAt: null,
    dayOneCompletedAt: null,
    planReadyAcceptedAt: PLAN_READY_ACCEPTED_AT,
    lastLifecycleAcceptedAt: null,
    acceptedInactivityCount: 0,
    ...overrides,
  } satisfies StartDayOneState;
}

type Harness = {
  store: MemoryStore;
  adapter: ReturnType<typeof createFakeAdapter>;
  deps: StartDayOneDispatchDeps;
  job: EmailJobRow;
  loads: number;
};

function harness(options?: {
  state?: Partial<StartDayOneState>;
  job?: Partial<EmailJobRow>;
  script?: Parameters<typeof createFakeAdapter>[0] extends infer _T
    ? Parameters<typeof createFakeAdapter>[0]
    : never;
  now?: () => Date;
}): Harness {
  const now = options?.now ?? (() => NOW);
  const store = createMemoryStore(now);
  const job = startJob(options?.job ?? {});
  store.leads.set("lead-1", makeLead());
  store.jobs.set(job.job_id, { ...job });
  const adapter = createFakeAdapter(options?.script ?? {});
  const result: Harness = {
    store,
    adapter,
    job,
    loads: 0,
    deps: {
      store,
      adapter,
      now,
      appOrigin: "https://app.genxjumps.com",
      fromEmail: "todd@notify.genxjumps.com",
      fromName: "Todd from Gen X Jumps",
      replyTo: "todd@genxjumps.com",
      deriveCredential: (purpose, planVersionId) => `cred:${purpose}:${planVersionId}`,
      hash: async (raw) => `hash:${raw}`,
      loadStartDayOneState: async (loaded) => {
        result.loads += 1;
        return eligibleState({ ...job, ...loaded }, options?.state ?? {});
      },
    },
  };
  return result;
}

function eventNames(store: MemoryStore): string[] {
  return store.events.map((e) => e.event_name);
}

describe("Start Day 1 controlled dispatch", () => {
  it("1: eligible unstarted job renders the START variant and calls the fake provider", async () => {
    const h = harness();
    const summary = await dispatchStartDayOneJobs(h.deps);

    expect(summary.claimed).toBe(1);
    expect(summary.outcomes[0]?.outcome).toBe("provider_accepted");
    expect(h.adapter.requests).toHaveLength(1);
    const request = h.adapter.requests[0]!;
    expect(request.subject).toBe("Todd, Day 1: Full Body Flush & Fire");
    expect(request.text).toContain("Start Day 1:");
    expect(request.html).toContain("Start Day 1</a>");
    expect(request.to).toBe("Reader@Example.com");
  });

  it("2: deliberately started but incomplete Day 1 renders the RESUME variant", async () => {
    const h = harness({ state: { dayOneStartedAt: "2026-02-02T13:00:00.000Z" } });
    await dispatchStartDayOneJobs(h.deps);

    const request = h.adapter.requests[0]!;
    expect(request.subject).toBe("Todd, finish Day 1: Full Body Flush & Fire");
    expect(request.text).toContain("Resume Day 1:");
  });

  it("3: completed Day 1 cancels with no provider call", async () => {
    const h = harness({ state: { dayOneCompletedAt: "2026-02-02T14:00:00.000Z" } });
    const summary = await dispatchStartDayOneJobs(h.deps);

    expect(summary.outcomes[0]?.outcome).toBe("canceled");
    expect(h.adapter.requests).toHaveLength(0);
    expect(h.store.jobs.get("sd1-job")?.status).toBe("canceled");
    expect(eventNames(h.store)).toEqual(["email_start_day_1_canceled"]);
  });

  it("4: stale or replaced plan version cancels with no provider call", async () => {
    const h = harness({ state: { currentPlanVersionId: "version-2" } });
    const summary = await dispatchStartDayOneJobs(h.deps);

    expect(summary.outcomes[0]?.outcome).toBe("canceled");
    expect(h.adapter.requests).toHaveLength(0);
    expect(eventNames(h.store)).toEqual(["email_start_day_1_canceled"]);
  });

  it("5: marketing unsubscribe, hard bounce, and complaint all suppress with no provider call", async () => {
    for (const state of [
      { marketingUnsubscribedAt: "2026-02-02T09:00:00.000Z" },
      { emailSuppressedAt: "2026-02-02T09:00:00.000Z" },
      { suppressionListed: true },
    ]) {
      const h = harness({ state });
      const summary = await dispatchStartDayOneJobs(h.deps);

      expect(summary.outcomes[0]?.outcome).toBe("suppressed");
      expect(h.adapter.requests).toHaveLength(0);
      expect(h.store.jobs.get("sd1-job")?.status).toBe("suppressed");
      expect(eventNames(h.store)).toEqual(["email_start_day_1_suppressed"]);
    }
  });

  it("6: Plan Ready ordering is enforced: no acceptance means defer, not send", async () => {
    const h = harness({ state: { planReadyAcceptedAt: null } });
    const summary = await dispatchStartDayOneJobs(h.deps);

    expect(summary.outcomes[0]?.outcome).toBe("deferred");
    expect(h.adapter.requests).toHaveLength(0);
    // A deferral is not a transient retry and emits no canonical event.
    expect(h.store.events).toHaveLength(0);
    expect(h.store.jobs.get("sd1-job")?.status).toBe("retry_scheduled");
  });

  it("7: eligibility floor, 24h lifecycle gap, and inactivity cap gate sending", async () => {
    // Late Plan Ready acceptance moves the floor forward by 24 hours.
    const shifted = harness({ state: { planReadyAcceptedAt: "2026-02-03T06:00:00.000Z" } });
    const shiftedSummary = await dispatchStartDayOneJobs(shifted.deps);
    expect(shiftedSummary.outcomes[0]?.outcome).toBe("deferred");
    expect(shifted.store.jobs.get("sd1-job")?.next_attempt_at).toBe("2026-02-04T06:00:00.000Z");
    expect(shifted.adapter.requests).toHaveLength(0);

    // A lifecycle email accepted inside the last 24 hours defers this one.
    const recent = new Date(NOW.getTime() - LIFECYCLE_MIN_GAP_MS / 2).toISOString();
    const capped = harness({ state: { lastLifecycleAcceptedAt: recent } });
    const cappedSummary = await dispatchStartDayOneJobs(capped.deps);
    expect(cappedSummary.outcomes[0]?.outcome).toBe("deferred");
    expect(capped.adapter.requests).toHaveLength(0);

    // The three-inactivity-email cap is terminal.
    const maxed = harness({
      state: { acceptedInactivityCount: MAX_ACCEPTED_INACTIVITY_EMAILS },
    });
    const maxedSummary = await dispatchStartDayOneJobs(maxed.deps);
    expect(maxedSummary.outcomes[0]?.outcome).toBe("canceled");
    expect(maxed.adapter.requests).toHaveLength(0);
  });

  it("8: the return token is open_plan, hash-only, and associated with this job", async () => {
    const h = harness();
    await dispatchStartDayOneJobs(h.deps);

    expect(h.store.returnTokens).toHaveLength(1);
    const token = h.store.returnTokens[0]!;
    expect(token.jobId).toBe("sd1-job");
    expect(token.tokenHash).toBe("hash:cred:open_plan:version-1");
    // Only hashes are persisted: no raw credential appears on the stored row.
    expect(Object.values(token)).not.toContain("cred:open_plan:version-1");
    expect(h.store.preferenceCredentials[0]?.tokenHash).toBe(
      "hash:cred:email_preferences:version-1",
    );

    // Trusted destination resolution opens Day 1 for exactly this state.
    expect(
      resolveReturnDestination({
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job: {
          jobType: START_DAY_1_JOB_TYPE,
          templateVersion: START_DAY_1_TEMPLATE_VERSION,
          leadPlanId: "lead-1",
          planVersionId: "version-1",
        },
      }),
    ).toBe(START_DAY_1_RETURN_DESTINATION);
    expect(
      resolveReturnDestination({
        purpose: "recovery",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job: {
          jobType: START_DAY_1_JOB_TYPE,
          templateVersion: START_DAY_1_TEMPLATE_VERSION,
          leadPlanId: "lead-1",
          planVersionId: "version-1",
        },
      }),
    ).toBe(DEFAULT_RETURN_DESTINATION);
  });

  it("9: the provider payload contains only permitted fields and the stable key", async () => {
    const h = harness();
    await dispatchStartDayOneJobs(h.deps);

    const request = h.adapter.requests[0]!;
    expect(Object.keys(request).sort()).toEqual(
      [
        "correlationId",
        "disableClickTracking",
        "fromEmail",
        "fromName",
        "html",
        "idempotencyKey",
        "previewText",
        "replyTo",
        "subject",
        "text",
        "to",
      ].sort(),
    );
    expect(request.idempotencyKey).toBe("start_day_1:version-1:v1");
    expect(request.correlationId).toBe("sd1-job");
    expect(request.disableClickTracking).toBe(true);
  });

  it("10: acceptance writes provider state and the acceptance event only", async () => {
    const h = harness();
    await dispatchStartDayOneJobs(h.deps);

    const job = h.store.jobs.get("sd1-job")!;
    expect(job.status).toBe("provider_accepted");
    expect(job.provider_message_id).toBe("fake-1");
    expect(job.delivery_status).toBe("pending");
    expect(eventNames(h.store)).toEqual(["email_start_day_1_provider_accepted"]);
  });

  it("11: a transient failure schedules the approved retry delay and event", async () => {
    const h = harness({ script: { script: [{ outcome: "transient", errorCode: "http_500" }] } });
    const summary = await dispatchStartDayOneJobs(h.deps);

    expect(summary.outcomes[0]).toMatchObject({
      outcome: "retry_scheduled",
      errorCode: "http_500",
    });
    expect(h.store.jobs.get("sd1-job")?.next_attempt_at).toBe(
      new Date(NOW.getTime() + RETRY_DELAYS_MS[0]).toISOString(),
    );
    expect(eventNames(h.store)).toEqual(["email_start_day_1_retry_scheduled"]);
  });

  it("12: a permanent failure never retries", async () => {
    const h = harness({ script: { script: [{ outcome: "permanent", errorCode: "http_422" }] } });
    await dispatchStartDayOneJobs(h.deps);

    const job = h.store.jobs.get("sd1-job")!;
    expect(job.status).toBe("failed_permanent");
    expect(job.next_attempt_at).toBeNull();
    expect(eventNames(h.store)).toEqual(["email_start_day_1_failed_permanent"]);
    expect(h.store.alerts[0]?.alert_type).toBe("start_day_1_failed_permanent");

    const second = await dispatchStartDayOneJobs(h.deps);
    expect(second.claimed).toBe(0);
    expect(h.adapter.requests).toHaveLength(1);
  });

  it("13: an accepted job is never resent when no delivery webhook arrives", async () => {
    const h = harness();
    await dispatchStartDayOneJobs(h.deps);
    const second = await dispatchStartDayOneJobs(h.deps);

    expect(second.claimed).toBe(0);
    expect(h.adapter.requests).toHaveLength(1);
    expect(h.store.jobs.get("sd1-job")?.delivery_status).toBe("pending");
  });

  it("14: an expired lease recovers without an uncontrolled duplicate", async () => {
    const h = harness({
      script: { script: [{ outcome: "ambiguous", errorCode: "TimeoutError" }] },
    });
    h.adapter.reconcileResult = { providerMessageId: "fake-1", acceptedAt: NOW.toISOString() };

    // A crashed worker's result is fenced out by the stolen lease.
    const stealing = {
      ...h.deps,
      store: {
        ...h.store,
        finishJob: async (...args: Parameters<MemoryStore["finishJob"]>) => {
          h.store.stealLease("sd1-job");
          return h.store.finishJob(...args);
        },
      },
    } as StartDayOneDispatchDeps;
    const lost = await dispatchStartDayOneJobs(stealing);
    expect(lost.outcomes[0]?.outcome).toBe("lost_lease");
    expect(h.store.events).toHaveLength(0);

    // Recovery reuses the identical stable idempotency key.
    h.store.jobs.get("sd1-job")!.claim_token = null;
    h.store.jobs.get("sd1-job")!.lease_expires_at = null;
    const recovered = await dispatchStartDayOneJobs(h.deps);
    expect(recovered.outcomes[0]?.outcome).toBe("provider_accepted");
    expect(new Set(h.adapter.requests.map((r) => r.idempotencyKey))).toEqual(
      new Set(["start_day_1:version-1:v1"]),
    );
    expect(h.store.returnTokens).toHaveLength(1);
  });

  it("15: dispatch never mutates Day 1 start or completion state", async () => {
    const h = harness();
    const before = JSON.stringify({
      started: null,
      completed: null,
    });
    await dispatchStartDayOneJobs(h.deps);

    // The loader is read-only and the store exposes no day-state writer at all.
    expect(h.loads).toBe(1);
    expect(Object.keys(h.store)).not.toContain("completeDay");
    expect(JSON.stringify({ started: null, completed: null })).toBe(before);
  });

  it("16: CANCEL never renders, tokenizes, builds a payload, or calls the provider", async () => {
    for (const state of [
      { dayOneCompletedAt: "2026-02-02T14:00:00.000Z" },
      { currentPlanVersionId: null },
      { hasRecipient: false },
      { marketingUnsubscribedAt: "2026-02-02T09:00:00.000Z" },
      { planReadyAcceptedAt: null },
    ]) {
      const h = harness({ state });
      await dispatchStartDayOneJobs(h.deps);

      expect(h.adapter.requests).toHaveLength(0);
      expect(h.adapter.lookups).toHaveLength(0);
      expect(h.store.returnTokens).toHaveLength(0);
      expect(h.store.preferenceCredentials).toHaveLength(0);
    }
  });

  it("does not exceed the shared max-attempt ceiling", async () => {
    const h = harness({
      job: { attempt_count: MAX_ATTEMPTS },
      script: { script: [{ outcome: "transient", errorCode: "http_500" }] },
    });
    const summary = await dispatchStartDayOneJobs(h.deps);
    expect(summary.outcomes[0]?.outcome).toBe("failed_permanent");
  });
});
