// Focused tests for shared lifecycle dispatch accounting:
//  - a non-provider deferral restores the claim-time attempt increment
//  - the lifecycle deferral horizon is separate from the provider retry horizon
//  - the first provider-attempt boundary is fenced and immutable
// Deterministic: mutable clock, in-memory store, injected fake provider.
import { describe, expect, it } from "vitest";

import { dispatchStartDayOneJobs, type StartDayOneDispatchDeps } from "@/lib/email/dispatch";
import { createFakeAdapter } from "@/lib/email/adapters.server";
import {
  IDEMPOTENCY_HORIZON_MS,
  MAX_ATTEMPTS,
  START_DAY_1_JOB_TYPE,
  START_DAY_1_JOB_VERSION,
  START_DAY_1_TEMPLATE_VERSION,
  type EmailJobRow,
} from "@/lib/email/types";
import type { StartDayOneState } from "@/lib/email/start-day-1-resolver";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";

const HOUR = 60 * 60 * 1000;
const START = new Date("2026-02-10T12:00:00.000Z");

type Harness = {
  store: MemoryStore;
  adapter: ReturnType<typeof createFakeAdapter>;
  deps: StartDayOneDispatchDeps;
  job: () => MemoryStore["jobs"] extends Map<string, infer T> ? T : never;
  advance: (ms: number) => void;
  setNow: (at: Date) => void;
};

function harness(options?: {
  state?: Partial<StartDayOneState>;
  job?: Partial<EmailJobRow>;
  script?: Parameters<typeof createFakeAdapter>[0];
}): Harness {
  let clock = new Date(START);
  const now = () => clock;
  const store = createMemoryStore(now);
  const job = makeJob({
    job_id: "sd1-job",
    job_type: START_DAY_1_JOB_TYPE,
    job_version: START_DAY_1_JOB_VERSION,
    template_version: START_DAY_1_TEMPLATE_VERSION,
    idempotency_key: "start_day_1:version-1:v1",
    created_at: new Date(START.getTime() - 48 * HOUR).toISOString(),
    eligible_at: new Date(START.getTime() - 24 * HOUR).toISOString(),
    ...options?.job,
  });
  store.leads.set("lead-1", makeLead());
  store.jobs.set(job.job_id, { ...job });
  const adapter = createFakeAdapter(options?.script ?? {});

  return {
    store,
    adapter,
    job: () => store.jobs.get("sd1-job")! as never,
    advance: (ms) => {
      clock = new Date(clock.getTime() + ms);
    },
    setNow: (at) => {
      clock = new Date(at);
    },
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
      loadStartDayOneState: async (loaded) => ({
        job: loaded,
        currentPlanVersionId: loaded.plan_version_id,
        hasRecipient: true,
        marketingUnsubscribedAt: null,
        emailSuppressedAt: null,
        suppressionListed: false,
        dayOneStartedAt: null,
        dayOneCompletedAt: null,
        // Long-settled Plan Ready acceptance: the eligibility floor and the
        // 24-hour lifecycle gap are both already satisfied.
        planReadyAcceptedAt: new Date(START.getTime() - 60 * HOUR).toISOString(),
        lastLifecycleAcceptedAt: null,
        acceptedInactivityCount: 0,
        halfwayPending: false,
        finalRescueAcceptedAt: null,
        finalRescueDueAt: null,
        ...options?.state,
      }),
    },
  };
}

describe("non-provider deferral accounting", () => {
  it("restores the claim-time increment so repeated deferrals never consume retry budget", async () => {
    // Plan Ready has not been accepted, so every pass is a lifecycle deferral.
    const h = harness({ state: { planReadyAcceptedAt: null } });

    for (let pass = 0; pass < MAX_ATTEMPTS + 4; pass += 1) {
      const summary = await dispatchStartDayOneJobs(h.deps);
      expect(summary.claimed).toBe(1);
      expect(summary.outcomes[0]).toEqual({ jobId: "sd1-job", outcome: "deferred" });
      // The claim increment is given back every time.
      expect(h.job().attempt_count).toBe(0);
      expect(h.job().status).toBe("retry_scheduled");
      h.advance(HOUR);
    }

    // No provider attempt, no retry event, and no manual-review parking.
    expect(h.adapter.requests).toHaveLength(0);
    expect(h.store.events).toHaveLength(0);
    expect(h.store.alerts).toHaveLength(0);
    expect(h.job().manual_review_at ?? null).toBeNull();
    expect(h.job().first_provider_attempt_at).toBeNull();
  });

  it("counts an actual provider attempt exactly once and keeps the stable key", async () => {
    const h = harness({
      script: {
        script: [
          { outcome: "transient", errorCode: "http_500" },
          {
            outcome: "accepted",
            providerKey: "fake",
            providerMessageId: "fake-2",
            acceptedAt: new Date(START.getTime() + HOUR).toISOString(),
          },
        ],
      },
    });

    const first = await dispatchStartDayOneJobs(h.deps);
    expect(first.outcomes[0]?.outcome).toBe("retry_scheduled");
    expect(h.job().attempt_count).toBe(1);

    // Wait out the scheduled retry, then let the second attempt succeed.
    h.advance(HOUR);
    const second = await dispatchStartDayOneJobs(h.deps);
    expect(second.outcomes[0]?.outcome).toBe("provider_accepted");
    expect(h.job().attempt_count).toBe(2);
    expect(h.adapter.requests).toHaveLength(2);
    expect(new Set(h.adapter.requests.map((r) => r.idempotencyKey))).toEqual(
      new Set(["start_day_1:version-1:v1"]),
    );
  });
});

describe("first provider-attempt boundary", () => {
  it("is recorded before the provider call and is immutable across retries", async () => {
    const h = harness({
      script: { script: [{ outcome: "transient", errorCode: "http_500" }] },
    });

    await dispatchStartDayOneJobs(h.deps);
    const boundary = h.job().first_provider_attempt_at;
    expect(boundary).toBe(START.toISOString());

    h.advance(2 * HOUR);
    await dispatchStartDayOneJobs(h.deps);
    expect(h.job().first_provider_attempt_at).toBe(boundary);
    expect(h.adapter.requests).toHaveLength(2);
  });

  it("never calls the provider when the lease is lost before the boundary is recorded", async () => {
    const h = harness();
    const fenced: StartDayOneDispatchDeps = {
      ...h.deps,
      store: {
        ...h.store,
        recordFirstProviderAttempt: async (jobId, claimToken, attemptedAt) => {
          // Another worker steals the lease in the same window.
          h.store.stealLease(jobId);
          return h.store.recordFirstProviderAttempt(jobId, claimToken, attemptedAt);
        },
      },
    };

    const summary = await dispatchStartDayOneJobs(fenced);
    expect(summary.outcomes[0]).toEqual({ jobId: "sd1-job", outcome: "lost_lease" });
    expect(h.adapter.requests).toHaveLength(0);
    expect(h.job().first_provider_attempt_at).toBeNull();
    expect(h.store.events).toHaveLength(0);

    // Recovery after the lease expires still performs exactly one send.
    h.job().claim_token = null;
    h.job().lease_expires_at = null;
    const recovered = await dispatchStartDayOneJobs(h.deps);
    expect(recovered.outcomes[0]?.outcome).toBe("provider_accepted");
    expect(h.adapter.requests).toHaveLength(1);
  });
});

describe("manual-review horizon boundaries", () => {
  it("uses the lifecycle floor while no provider attempt has happened", async () => {
    // Created far outside the horizon, but legitimately deferred until recently.
    const h = harness({
      job: {
        created_at: new Date(START.getTime() - 20 * 24 * HOUR).toISOString(),
        eligible_at: new Date(START.getTime() - 20 * 24 * HOUR).toISOString(),
        next_attempt_at: new Date(START.getTime() - HOUR).toISOString(),
        status: "retry_scheduled",
      },
    });

    const summary = await dispatchStartDayOneJobs(h.deps);
    expect(summary.outcomes[0]?.outcome).toBe("provider_accepted");
    expect(h.job().manual_review_at ?? null).toBeNull();
  });

  it("is governed only by the original provider attempt once one has happened", async () => {
    const h = harness({
      job: {
        first_provider_attempt_at: new Date(
          START.getTime() - IDEMPOTENCY_HORIZON_MS - HOUR,
        ).toISOString(),
        // A recent retry schedule must not reset or extend the provider horizon.
        next_attempt_at: new Date(START.getTime() - 60_000).toISOString(),
        status: "retry_scheduled",
        attempt_count: 1,
      },
    });

    const summary = await dispatchStartDayOneJobs(h.deps);
    expect(summary.outcomes[0]).toMatchObject({
      outcome: "manual_review",
      errorCode: "idempotency_horizon_exceeded",
    });
    expect(h.adapter.requests).toHaveLength(0);
    expect(h.job().status).toBe("failed_permanent");
    expect(h.job().manual_review_at).toBe(START.toISOString());
    expect(h.store.alerts[0]?.alert_type).toBe("start_day_1_manual_review_required");
  });

  it("still sends inside the provider horizon after a delayed retry", async () => {
    const h = harness({
      job: {
        first_provider_attempt_at: new Date(START.getTime() - 6 * HOUR).toISOString(),
        next_attempt_at: new Date(START.getTime() - 60_000).toISOString(),
        status: "retry_scheduled",
        attempt_count: 1,
      },
    });

    const summary = await dispatchStartDayOneJobs(h.deps);
    expect(summary.outcomes[0]?.outcome).toBe("provider_accepted");
    // The immutable boundary is untouched by the later successful attempt.
    expect(h.job().first_provider_attempt_at).toBe(
      new Date(START.getTime() - 6 * HOUR).toISOString(),
    );
  });
});
