// Acceptance tests for the Halfway (halfway_v1) lifecycle email (7.10.1).
// Deterministic: fixed clock, in-memory store, injected fake provider, and an
// injected authoritative state loader. No database, no network, no real sending.
import { describe, expect, it } from "vitest";

import { dispatchHalfwayJobs, type HalfwayDispatchDeps } from "@/lib/email/dispatch";
import { createFakeAdapter } from "@/lib/email/adapters.server";
import {
  HALFWAY_JOB_TYPE,
  HALFWAY_JOB_VERSION,
  HALFWAY_MAX_COMPLETIONS,
  HALFWAY_MIN_COMPLETIONS,
  HALFWAY_TEMPLATE_VERSION,
  HALFWAY_TRIGGER_COMPLETIONS,
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  type EmailJobRow,
} from "@/lib/email/types";
import { LIFECYCLE_MIN_GAP_MS } from "@/lib/email/start-day-1-resolver";
import { resolveHalfway, type HalfwayState } from "@/lib/email/halfway-resolver";
import { HALFWAY_CTA_LABEL, renderHalfway } from "@/lib/email/halfway-template";
import { lifecycleEventName } from "@/lib/email/event-names";
import {
  DEFAULT_RETURN_DESTINATION,
  resolveReturnDestination,
} from "@/lib/email/return-destination";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";

const NOW = new Date("2026-02-06T12:00:00.000Z");
const ELIGIBLE_AT = "2026-02-06T11:00:00.000Z";
const PLAN_READY_ACCEPTED_AT = "2026-02-01T12:00:05.000Z";

function halfwayJob(overrides: Partial<EmailJobRow> = {}): EmailJobRow {
  return makeJob({
    job_id: "halfway-job",
    job_type: HALFWAY_JOB_TYPE,
    job_version: HALFWAY_JOB_VERSION,
    template_version: HALFWAY_TEMPLATE_VERSION,
    idempotency_key: `halfway:version-1:${HALFWAY_JOB_VERSION}`,
    created_at: "2026-02-06T11:00:00.000Z",
    eligible_at: ELIGIBLE_AT,
    ...overrides,
  });
}

function eligibleState(job: EmailJobRow, overrides: Partial<HalfwayState> = {}): HalfwayState {
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
    requiredCompletions: HALFWAY_TRIGGER_COMPLETIONS,
    planReadyAcceptedAt: PLAN_READY_ACCEPTED_AT,
    lastLifecycleAcceptedAt: null,
    ...overrides,
  } satisfies HalfwayState;
}

type Harness = {
  store: MemoryStore;
  adapter: ReturnType<typeof createFakeAdapter>;
  deps: HalfwayDispatchDeps;
  job: EmailJobRow;
  loads: number;
};

function harness(options?: {
  state?: Partial<HalfwayState>;
  job?: Partial<EmailJobRow>;
  script?: Parameters<typeof createFakeAdapter>[0];
  now?: () => Date;
}): Harness {
  const now = options?.now ?? (() => NOW);
  const store = createMemoryStore(now);
  const job = halfwayJob(options?.job ?? {});
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
      loadHalfwayState: async (loaded) => {
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

const RENDER_INPUT = {
  firstName: "Todd",
  returnUrl: "https://app.genxjumps.com/return?token=abc",
  preferencesUrl: "https://app.genxjumps.com/email-preferences?c=def",
};

describe("Halfway job identity and creation contract", () => {
  it("1: canonical job type, version and template version are locked", () => {
    expect(HALFWAY_JOB_TYPE).toBe("halfway");
    expect(HALFWAY_JOB_VERSION).toBe("v1");
    expect(HALFWAY_TEMPLATE_VERSION).toBe("halfway_v1");
  });

  it("2: idempotency key is halfway:{plan_version_id}:v1", () => {
    expect(halfwayJob().idempotency_key).toBe("halfway:version-1:v1");
  });

  it("3: the creation trigger is the 4th required completion inside the 4 to 6 window", () => {
    expect(HALFWAY_TRIGGER_COMPLETIONS).toBe(4);
    expect(HALFWAY_MIN_COMPLETIONS).toBe(4);
    expect(HALFWAY_MAX_COMPLETIONS).toBe(6);
  });

  it("4: canonical lifecycle event names use the email_halfway namespace", () => {
    expect(lifecycleEventName(HALFWAY_JOB_TYPE, "provider_accepted")).toBe(
      "email_halfway_provider_accepted",
    );
    expect(lifecycleEventName(HALFWAY_JOB_TYPE, "delivered")).toBe("email_halfway_delivered");
    expect(lifecycleEventName(HALFWAY_JOB_TYPE, "canceled")).toBe("email_halfway_canceled");
  });
});

describe("Halfway resolver", () => {
  it("5: returns SEND for an eligible plan at 4 completions", () => {
    expect(resolveHalfway(eligibleState(halfwayJob()), NOW)).toEqual({ action: "SEND" });
  });

  it("6: stays sendable through the top of the window at 6 completions", () => {
    const state = eligibleState(halfwayJob(), { requiredCompletions: 6 });
    expect(resolveHalfway(state, NOW).action).toBe("SEND");
  });

  it("7: cancels when progress passed the window", () => {
    const state = eligibleState(halfwayJob(), { requiredCompletions: 7 });
    expect(resolveHalfway(state, NOW)).toMatchObject({
      action: "CANCEL",
      reason: "progress_window_passed",
      disposition: "cancel",
    });
  });

  it("8: cancels when progress is below the window", () => {
    const state = eligibleState(halfwayJob(), { requiredCompletions: 3 });
    expect(resolveHalfway(state, NOW)).toMatchObject({
      reason: "progress_window_not_reached",
      disposition: "cancel",
    });
  });

  it("9: cancels a non-canonical job", () => {
    const state = eligibleState(halfwayJob({ template_version: "halfway_v2" }));
    expect(resolveHalfway(state, NOW)).toMatchObject({
      reason: "job_not_canonical",
      disposition: "cancel",
    });
  });

  it("10: cancels when the plan version was replaced", () => {
    const state = eligibleState(halfwayJob(), { currentPlanVersionId: "version-2" });
    expect(resolveHalfway(state, NOW)).toMatchObject({
      reason: "plan_version_replaced",
      disposition: "cancel",
    });
  });

  it("11: cancels when no deliverable recipient is persisted", () => {
    const state = eligibleState(halfwayJob(), { hasRecipient: false });
    expect(resolveHalfway(state, NOW)).toMatchObject({
      reason: "recipient_missing",
      disposition: "cancel",
    });
  });

  it("12: suppresses a marketing unsubscribe", () => {
    const state = eligibleState(halfwayJob(), {
      marketingUnsubscribedAt: "2026-02-05T00:00:00.000Z",
    });
    expect(resolveHalfway(state, NOW)).toMatchObject({
      reason: "marketing_unsubscribed",
      disposition: "suppress",
    });
  });

  it("13: suppresses a hard bounce or complaint", () => {
    const listed = eligibleState(halfwayJob(), { suppressionListed: true });
    const flagged = eligibleState(halfwayJob(), {
      emailSuppressedAt: "2026-02-05T00:00:00.000Z",
    });
    expect(resolveHalfway(listed, NOW)).toMatchObject({
      reason: "recipient_suppressed",
      disposition: "suppress",
    });
    expect(resolveHalfway(flagged, NOW)).toMatchObject({
      reason: "recipient_suppressed",
      disposition: "suppress",
    });
  });

  it("14: defers until Plan Ready was accepted", () => {
    const state = eligibleState(halfwayJob(), { planReadyAcceptedAt: null });
    expect(resolveHalfway(state, NOW)).toMatchObject({
      reason: "plan_ready_not_accepted",
      disposition: "defer",
    });
  });

  it("15: defers before the job eligibility floor and reports the floor", () => {
    const job = halfwayJob({ eligible_at: "2026-02-06T18:00:00.000Z" });
    expect(resolveHalfway(eligibleState(job), NOW)).toMatchObject({
      reason: "eligibility_floor_not_reached",
      disposition: "defer",
      eligibleAt: "2026-02-06T18:00:00.000Z",
    });
  });

  it("16: defers inside the 24 hour lifecycle gap and reports the next allowed time", () => {
    const last = new Date(NOW.getTime() - 60_000).toISOString();
    const state = eligibleState(halfwayJob(), { lastLifecycleAcceptedAt: last });
    expect(resolveHalfway(state, NOW)).toMatchObject({
      reason: "lifecycle_24h_cap",
      disposition: "defer",
      eligibleAt: new Date(new Date(last).getTime() + LIFECYCLE_MIN_GAP_MS).toISOString(),
    });
  });

  it("17: sends once the 24 hour lifecycle gap has elapsed", () => {
    const last = new Date(NOW.getTime() - LIFECYCLE_MIN_GAP_MS).toISOString();
    const state = eligibleState(halfwayJob(), { lastLifecycleAcceptedAt: last });
    expect(resolveHalfway(state, NOW).action).toBe("SEND");
  });

  it("18: is pure and never mutates the state it is given", () => {
    const state = eligibleState(halfwayJob());
    const before = JSON.stringify(state);
    resolveHalfway(state, NOW);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("Halfway template", () => {
  it("19: renders the Continue My Plan CTA, the signature, and no images", () => {
    const rendered = renderHalfway({ action: "SEND" }, RENDER_INPUT)!;
    expect(rendered.ctaLabel).toBe(HALFWAY_CTA_LABEL);
    expect(rendered.html).toContain("Continue My Plan</a>");
    expect(rendered.text).toContain("Continue My Plan: https://app.genxjumps.com/return?token=abc");
    expect(rendered.text).toContain("Move or Rust.");
    expect(rendered.text).toContain("Todd");
    expect(rendered.text).toContain("Gen X Jumps");
    expect(rendered.html).not.toContain("<img");
  });

  it("20: personalizes the subject and falls back safely", () => {
    expect(renderHalfway({ action: "SEND" }, RENDER_INPUT)!.subject).toBe(
      "Todd, you are halfway there",
    );
    const anonymous = renderHalfway({ action: "SEND" }, { ...RENDER_INPUT, firstName: null })!;
    expect(anonymous.subject).toBe("You are halfway through your 7-Day Comeback Plan");
    expect(anonymous.personalizedName).toBeNull();
    expect(anonymous.text).toContain("Hey there,");
  });

  it("21: hides the preview text, keeps the shared footer, and links preferences", () => {
    const rendered = renderHalfway({ action: "SEND" }, RENDER_INPUT)!;
    expect(rendered.previewText).toBe("Three days left. Keep the momentum.");
    expect(rendered.html).toContain('style="display:none;max-height:0;overflow:hidden;opacity:0;"');
    expect(rendered.html).toContain(RENDER_INPUT.preferencesUrl);
    expect(rendered.text).toContain(`Manage email preferences: ${RENDER_INPUT.preferencesUrl}`);
  });

  it("22: never renders a canceled resolution", () => {
    const canceled = renderHalfway(
      { action: "CANCEL", reason: "progress_window_passed", disposition: "cancel" },
      RENDER_INPUT,
    );
    expect(canceled).toBeNull();
  });
});

describe("Halfway controlled dispatch", () => {
  it("23: reloads state at dispatch time, sends once, and records acceptance", async () => {
    const h = harness();
    const summary = await dispatchHalfwayJobs(h.deps);

    expect(summary.claimed).toBe(1);
    expect(h.loads).toBe(1);
    expect(summary.outcomes[0]?.outcome).toBe("provider_accepted");
    expect(h.adapter.requests).toHaveLength(1);
    const request = h.adapter.requests[0]!;
    expect(request.idempotencyKey).toBe("halfway:version-1:v1");
    expect(request.disableClickTracking).toBe(true);
    expect(request.to).toBe("Reader@Example.com");
    expect(eventNames(h.store)).toContain("email_halfway_provider_accepted");
    expect(h.store.jobs.get("halfway-job")?.status).toBe("provider_accepted");
  });

  it("24: a CANCEL resolution never renders, never issues a credential, and never calls the provider", async () => {
    const h = harness({ state: { requiredCompletions: 7 } });
    const summary = await dispatchHalfwayJobs(h.deps);

    expect(summary.outcomes[0]?.outcome).toBe("canceled");
    expect(h.adapter.requests).toHaveLength(0);
    expect(h.store.returnTokens).toHaveLength(0);
    expect(h.store.preferenceCredentials).toHaveLength(0);
    expect(h.store.jobs.get("halfway-job")?.status).toBe("canceled");
  });

  it("25: a deferral keeps the job claimable later and emits no false retry event", async () => {
    const h = harness({ job: { eligible_at: "2026-02-06T18:00:00.000Z" } });
    const summary = await dispatchHalfwayJobs(h.deps);

    expect(summary.outcomes[0]?.outcome).toBe("deferred");
    const job = h.store.jobs.get("halfway-job")!;
    expect(job.status).toBe("retry_scheduled");
    expect(job.next_attempt_at).toBe("2026-02-06T18:00:00.000Z");
    expect(eventNames(h.store)).not.toContain("email_halfway_retry_scheduled");
    expect(h.adapter.requests).toHaveLength(0);
  });

  it("26: reuses shared retry, suppression, and open_plan CTA infrastructure", async () => {
    // Transient provider failure reuses the shared retry schedule.
    const transient = harness({
      script: { script: [{ outcome: "transient", errorCode: "provider_5xx" }] },
    });
    const retried = await dispatchHalfwayJobs(transient.deps);
    expect(retried.outcomes[0]).toMatchObject({
      outcome: "retry_scheduled",
      errorCode: "provider_5xx",
    });
    expect(transient.store.jobs.get("halfway-job")?.next_attempt_at).toBe(
      new Date(NOW.getTime() + RETRY_DELAYS_MS[0]!).toISOString(),
    );
    expect(MAX_ATTEMPTS).toBe(6);

    // Suppression disposition parks the job without a provider attempt.
    const suppressed = harness({ state: { suppressionListed: true } });
    const suppressedSummary = await dispatchHalfwayJobs(suppressed.deps);
    expect(suppressedSummary.outcomes[0]?.outcome).toBe("suppressed");
    expect(suppressed.adapter.requests).toHaveLength(0);

    // The CTA credential is an ordinary open_plan token with no job association,
    // so a completed exchange redirects to the general plan hub.
    const sent = harness();
    await dispatchHalfwayJobs(sent.deps);
    expect(sent.store.returnTokens).toHaveLength(1);
    expect(sent.store.returnTokens[0]?.jobId).toBeUndefined();
    expect(sent.store.preferenceCredentials).toHaveLength(1);
    expect(
      resolveReturnDestination({
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job: {
          jobType: HALFWAY_JOB_TYPE,
          templateVersion: HALFWAY_TEMPLATE_VERSION,
          leadPlanId: "lead-1",
          planVersionId: "version-1",
        },
      }),
    ).toBe(DEFAULT_RETURN_DESTINATION);
  });
});
