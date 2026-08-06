// Acceptance tests for the Final Rescue lifecycle (final_rescue_v1).
//
// Deterministic and offline: fixed clock, in-memory store, injected fake
// provider, injected authoritative state loader, and assertions against the
// committed migration SQL for database-boundary behavior — the same mechanism
// already used for Halfway and Stalled. No database, no network, no sending.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dispatchFinalRescueJobs, type FinalRescueDispatchDeps } from "@/lib/email/dispatch";
import { createFakeAdapter } from "@/lib/email/adapters.server";
import {
  FINAL_RESCUE_INITIAL_DELAY_MS,
  FINAL_RESCUE_JOB_TYPE,
  FINAL_RESCUE_JOB_VERSION,
  FINAL_RESCUE_REANCHOR_DELAY_MS,
  FINAL_RESCUE_TEMPLATE_VERSION,
  finalRescueJobKey,
  type EmailJobRow,
} from "@/lib/email/types";
import {
  finalRescueVariant,
  resolveFinalRescue,
  type FinalRescueState,
} from "@/lib/email/final-rescue-resolver";
import {
  FINAL_RESCUE_COPY,
  FINAL_RESCUE_RECOVERY_PATH,
  renderFinalRescue,
} from "@/lib/email/final-rescue-template";
import {
  finalRescueDueControls,
  LIFECYCLE_MIN_GAP_MS,
  MAX_ACCEPTED_INACTIVITY_EMAILS,
  resolveStartDayOne,
  type StartDayOneState,
} from "@/lib/email/start-day-1-resolver";
import { resolveStalled, stalledEpisodeKey, type StalledState } from "@/lib/email/stalled-resolver";
import {
  FINAL_RESCUE_LINK_EXCHANGE_EVENT,
  PLAN_READY_LINK_EXCHANGE_EVENT,
  resolveLinkExchangeAttribution,
} from "@/lib/email/link-exchange-event";
import {
  DEFAULT_RETURN_DESTINATION,
  resolveReturnDestination,
} from "@/lib/email/return-destination";
import { lifecycleEventName } from "@/lib/email/event-names";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";

const NOW = new Date("2026-02-05T18:00:00.000Z");
/** Commit + 4 days, already reached at NOW. */
const ELIGIBLE_AT = "2026-02-05T12:00:00.000Z";
const PLAN_READY_ACCEPTED_AT = "2026-02-01T12:00:05.000Z";

const MIGRATION = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260806175920_582a324d-47f9-44ac-aec4-1ad8b86eb7d6.sql",
  ),
  "utf8",
);

function rescueJob(overrides: Partial<EmailJobRow> = {}): EmailJobRow {
  return makeJob({
    job_id: "fr-job",
    job_type: FINAL_RESCUE_JOB_TYPE,
    job_version: FINAL_RESCUE_JOB_VERSION,
    template_version: FINAL_RESCUE_TEMPLATE_VERSION,
    idempotency_key: finalRescueJobKey("version-1"),
    created_at: "2026-02-01T12:00:00.000Z",
    eligible_at: ELIGIBLE_AT,
    ...overrides,
  });
}

function sendableState(
  job: Pick<
    EmailJobRow,
    | "job_id"
    | "job_type"
    | "job_version"
    | "template_version"
    | "lead_plan_id"
    | "plan_version_id"
    | "idempotency_key"
    | "eligible_at"
  >,
  overrides: Partial<FinalRescueState> = {},
): FinalRescueState {
  return {
    job: {
      job_id: job.job_id,
      job_type: job.job_type,
      job_version: job.job_version,
      template_version: job.template_version,
      lead_plan_id: job.lead_plan_id,
      plan_version_id: job.plan_version_id,
      idempotency_key: job.idempotency_key,
      eligible_at: job.eligible_at,
    },
    currentPlanVersionId: job.plan_version_id,
    hasRecipient: true,
    marketingUnsubscribedAt: null,
    emailSuppressedAt: null,
    suppressionListed: false,
    planComplete: false,
    planCompletedControl: false,
    halfwayPending: false,
    finalRescueAcceptedAt: null,
    dayOneStartedAt: null,
    requiredCompletions: 0,
    totalRequiredAssignments: 7,
    planReadyAcceptedAt: PLAN_READY_ACCEPTED_AT,
    lastLifecycleAcceptedAt: null,
    acceptedInactivityCount: 0,
    ...overrides,
  } satisfies FinalRescueState;
}

type Harness = {
  store: MemoryStore;
  adapter: ReturnType<typeof createFakeAdapter>;
  deps: FinalRescueDispatchDeps;
  job: EmailJobRow;
};

function harness(options?: {
  state?: Partial<FinalRescueState>;
  job?: Partial<EmailJobRow>;
  adapter?: Parameters<typeof createFakeAdapter>[0];
  now?: () => Date;
}): Harness {
  const now = options?.now ?? (() => NOW);
  const store = createMemoryStore(now);
  const job = rescueJob(options?.job ?? {});
  store.leads.set("lead-1", makeLead());
  store.jobs.set(job.job_id, { ...job });
  const adapter = createFakeAdapter(options?.adapter ?? {});

  return {
    store,
    adapter,
    job,
    deps: {
      store,
      adapter,
      now,
      appOrigin: "https://app.genxjumps.com",
      fromEmail: "todd@notify.genxjumps.com",
      fromName: "Todd from Gen X Jumps",
      replyTo: "todd@genxjumps.com",
      deriveCredential: (purpose, planVersionId, scope) =>
        `cred:${purpose}:${planVersionId}:${scope ?? "none"}`,
      hash: async (raw) => `hash:${raw}`,
      loadFinalRescueState: async (loaded) => sendableState(loaded, options?.state ?? {}),
    },
  };
}

function eventNames(store: MemoryStore): string[] {
  return store.events.map((e) => e.event_name);
}

describe("F1 locked Final Rescue identity", () => {
  it("uses the canonical job type, version, template version and logical key", () => {
    expect(FINAL_RESCUE_JOB_TYPE).toBe("final_rescue");
    expect(FINAL_RESCUE_JOB_VERSION).toBe("v1");
    expect(FINAL_RESCUE_TEMPLATE_VERSION).toBe("final_rescue_v1");
    expect(finalRescueJobKey("version-1")).toBe("final_rescue:version-1:v1");
  });

  it("locks the 4-day initial horizon and the 5-day re-anchor horizon", () => {
    expect(FINAL_RESCUE_INITIAL_DELAY_MS).toBe(4 * 86_400_000);
    expect(FINAL_RESCUE_REANCHOR_DELAY_MS).toBe(5 * 86_400_000);
  });

  it("emits the approved canonical event names and omits manual review", () => {
    expect(lifecycleEventName(FINAL_RESCUE_JOB_TYPE, "provider_accepted")).toBe(
      "email_final_rescue_provider_accepted",
    );
    expect(lifecycleEventName(FINAL_RESCUE_JOB_TYPE, "delivered")).toBe(
      "email_final_rescue_delivered",
    );
    expect(lifecycleEventName(FINAL_RESCUE_JOB_TYPE, "canceled")).toBe(
      "email_final_rescue_canceled",
    );
    expect(lifecycleEventName(FINAL_RESCUE_JOB_TYPE, "manual_review")).toBeNull();
  });
});

describe("F2 durable job creation and re-anchoring at the database boundary", () => {
  it("creates exactly one job per newly committed plan version, anchored to commit + 4 days", () => {
    expect(MIGRATION).toContain("'final_rescue:' || v_version::text || ':v1'");
    expect(MIGRATION).toContain("v_now + interval '4 days', 'pending', v_now, v_now");
    expect(MIGRATION).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
  });

  it("emits the queued event only when a job row was actually created", () => {
    expect(MIGRATION).toContain("IF v_final_rescue_job_id IS NOT NULL THEN");
    expect(MIGRATION).toContain("'email_final_rescue_queued'");
  });

  it("re-anchors to + 5 days on a deliberate Day 1 start and on new required progress", () => {
    const reanchors = MIGRATION.match(/eligible_at = v_started_at \+ interval '5 days'/g) ?? [];
    expect(reanchors).toHaveLength(1);
    expect(MIGRATION).toContain("eligible_at = v_completed_at + interval '5 days'");
  });

  it("never re-anchors or cancels an already accepted send", () => {
    const guarded = MIGRATION.split("AND job_type = 'final_rescue'").slice(1);
    expect(guarded.length).toBeGreaterThan(0);
    for (const block of guarded) {
      expect(block.slice(0, 200)).toContain("provider_accepted_at IS NULL");
    }
  });

  it("cancels the unsent job with one canceled event when the plan completes", () => {
    expect(MIGRATION).toContain("SELECT 'email_final_rescue_canceled', 'v1', p_lead_plan_id");
    expect(MIGRATION).toContain("status = 'canceled'");
  });

  it("releases any in-flight lease when re-anchoring, so a stale claim cannot send", () => {
    expect(MIGRATION).toContain("claim_token = NULL");
    expect(MIGRATION).toContain("lease_expires_at = NULL");
  });
});

describe("F3 resolver derives every outcome from persisted state only", () => {
  const job = rescueJob();

  it("sends the unstarted variant with no deliberate start and no required progress", () => {
    expect(resolveFinalRescue(sendableState(job), NOW)).toEqual({
      action: "SEND",
      variant: "unstarted",
    });
  });

  it("sends the started variant after a deliberate start or any required completion", () => {
    expect(finalRescueVariant({ dayOneStartedAt: "x", requiredCompletions: 0 })).toBe("started");
    expect(finalRescueVariant({ dayOneStartedAt: null, requiredCompletions: 2 })).toBe("started");
    expect(finalRescueVariant({ dayOneStartedAt: null, requiredCompletions: 0 })).toBe("unstarted");
    expect(resolveFinalRescue(sendableState(job, { requiredCompletions: 3 }), NOW)).toEqual({
      action: "SEND",
      variant: "started",
    });
  });

  it("cancels permanently for non-applicable plan-version state", () => {
    const cases: Array<[Partial<FinalRescueState>, string]> = [
      [{ currentPlanVersionId: "version-2" }, "plan_version_replaced"],
      [{ currentPlanVersionId: null }, "plan_version_replaced"],
      [{ planComplete: true }, "plan_completed"],
      [{ planCompletedControl: true }, "plan_completed"],
      [{ finalRescueAcceptedAt: "2026-02-05T13:00:00.000Z" }, "already_sent"],
      [{ hasRecipient: false }, "recipient_missing"],
      [{ acceptedInactivityCount: MAX_ACCEPTED_INACTIVITY_EMAILS }, "inactivity_cap_reached"],
    ];
    for (const [overrides, reason] of cases) {
      expect(resolveFinalRescue(sendableState(job, overrides), NOW)).toEqual({
        action: "CANCEL",
        reason,
      });
    }
  });

  it("cancels a non-canonical job without any send", () => {
    for (const bad of [
      { job_type: "stalled" },
      { job_version: "v2" },
      { template_version: "final_rescue_v2" },
      { idempotency_key: "final_rescue:other:v1" },
    ]) {
      const state = sendableState({ ...job, ...bad });
      expect(resolveFinalRescue(state, NOW)).toEqual({
        action: "CANCEL",
        reason: "job_not_canonical",
      });
    }
  });

  it("suppresses for unsubscribe, hard bounce and complaint", () => {
    expect(
      resolveFinalRescue(
        sendableState(job, { marketingUnsubscribedAt: "2026-02-05T09:00:00.000Z" }),
        NOW,
      ),
    ).toEqual({ action: "SUPPRESS", reason: "marketing_unsubscribed" });
    expect(
      resolveFinalRescue(
        sendableState(job, { emailSuppressedAt: "2026-02-05T09:00:00.000Z" }),
        NOW,
      ),
    ).toEqual({ action: "SUPPRESS", reason: "recipient_suppressed" });
    expect(resolveFinalRescue(sendableState(job, { suppressionListed: true }), NOW)).toEqual({
      action: "SUPPRESS",
      reason: "recipient_suppressed",
    });
  });

  it("defers before the persisted horizon, behind Halfway, before Plan Ready, and inside the 24h gap", () => {
    expect(resolveFinalRescue(sendableState(job), new Date("2026-02-04T12:00:00.000Z"))).toEqual({
      action: "DEFER",
      reason: "eligibility_not_reached",
      eligibleAt: ELIGIBLE_AT,
    });
    expect(resolveFinalRescue(sendableState(job, { halfwayPending: true }), NOW)).toEqual({
      action: "DEFER",
      reason: "halfway_priority",
    });
    expect(resolveFinalRescue(sendableState(job, { planReadyAcceptedAt: null }), NOW)).toEqual({
      action: "DEFER",
      reason: "plan_ready_not_accepted",
    });
    const recent = new Date(NOW.getTime() - 3_600_000).toISOString();
    expect(
      resolveFinalRescue(sendableState(job, { lastLifecycleAcceptedAt: recent }), NOW),
    ).toEqual({
      action: "DEFER",
      reason: "lifecycle_24h_cap",
      eligibleAt: new Date(new Date(recent).getTime() + LIFECYCLE_MIN_GAP_MS).toISOString(),
    });
  });

  it("sends once the shared 24-hour lifecycle gap has fully elapsed", () => {
    const gapCleared = new Date(NOW.getTime() - LIFECYCLE_MIN_GAP_MS).toISOString();
    expect(
      resolveFinalRescue(sendableState(job, { lastLifecycleAcceptedAt: gapCleared }), NOW),
    ).toEqual({ action: "SEND", variant: "unstarted" });
  });
});

describe("F4 approved template copy for both variants", () => {
  const rendered = (variant: "unstarted" | "started", firstName: string | null = "Todd") =>
    renderFinalRescue(
      { action: "SEND", variant },
      {
        firstName,
        returnUrl: "https://app.genxjumps.com/return?t=secret-token",
        preferencesUrl: "https://app.genxjumps.com/email-preferences?t=pref-token",
        appOrigin: "https://app.genxjumps.com",
      },
    )!;

  it("renders the approved unstarted subject, body and CTA", () => {
    const out = rendered("unstarted");
    expect(out.subject).toBe("Todd, your 7-day plan is still waiting");
    expect(out.ctaLabel).toBe(FINAL_RESCUE_COPY.unstarted.ctaLabel);
    expect(out.text).toContain("Your 7-Day Comeback Plan is still here.");
    expect(out.text).toContain("Open My Plan: https://app.genxjumps.com/return?t=secret-token");
  });

  it("renders the approved started subject, body and CTA", () => {
    const out = rendered("started");
    expect(out.subject).toBe("Todd, pick up where you left off");
    expect(out.ctaLabel).toBe("Return to My Plan");
    expect(out.text).toContain("Your progress is saved.");
  });

  it("falls back to the approved impersonal greeting and subject with no usable name", () => {
    const out = rendered("unstarted", null);
    expect(out.subject).toBe("Your 7-day plan is still waiting");
    expect(out.personalizedName).toBeNull();
    expect(out.text).toContain("Hey there,");
  });

  it("uses a token-free absolute recovery URL with no query string", () => {
    const out = rendered("started");
    expect(out.recoveryUrl).toBe(`https://app.genxjumps.com${FINAL_RESCUE_RECOVERY_PATH}`);
    expect(out.recoveryUrl).not.toContain("?");
    expect(out.recoveryUrl).not.toContain("secret-token");
  });

  it("never renders a message for a non-SEND resolution", () => {
    expect(
      renderFinalRescue(
        { action: "CANCEL", reason: "plan_completed" },
        { firstName: "Todd", returnUrl: "https://x/return", preferencesUrl: "https://x/prefs" },
      ),
    ).toBeNull();
    expect(
      renderFinalRescue(
        { action: "DEFER", reason: "halfway_priority" },
        { firstName: "Todd", returnUrl: "https://x/return", preferencesUrl: "https://x/prefs" },
      ),
    ).toBeNull();
  });

  it("includes the preferences link in every variant", () => {
    for (const variant of ["unstarted", "started"] as const) {
      expect(rendered(variant).text).toContain(
        "Manage email preferences: https://app.genxjumps.com/email-preferences?t=pref-token",
      );
    }
  });
});

describe("F5 controlled dispatch and idempotency", () => {
  it("sends an eligible job once, with the stable logical key and click tracking off", async () => {
    const h = harness();
    const summary = await dispatchFinalRescueJobs(h.deps);

    expect(summary.claimed).toBe(1);
    expect(summary.outcomes[0]?.outcome).toBe("provider_accepted");
    expect(h.adapter.requests).toHaveLength(1);
    const request = h.adapter.requests[0]!;
    expect(request.idempotencyKey).toBe(finalRescueJobKey("version-1"));
    expect(request.disableClickTracking).toBe(true);
    expect(request.to).toBe("Reader@Example.com");
    expect(request.subject).toBe("Todd, your 7-day plan is still waiting");
    expect(eventNames(h.store)).toEqual(["email_final_rescue_provider_accepted"]);
  });

  it("is terminal: a second dispatch run after acceptance makes no provider call", async () => {
    const h = harness();
    await dispatchFinalRescueJobs(h.deps);
    const again = await dispatchFinalRescueJobs(h.deps);

    expect(again.claimed).toBe(0);
    expect(h.adapter.requests).toHaveLength(1);
    expect(h.store.jobs.get("fr-job")?.status).toBe("provider_accepted");
  });

  it("cancels an already-accepted job on reload with no second provider call", async () => {
    const h = harness({ state: { finalRescueAcceptedAt: "2026-02-05T13:00:00.000Z" } });
    const summary = await dispatchFinalRescueJobs(h.deps);

    expect(summary.outcomes[0]?.outcome).toBe("canceled");
    expect(h.adapter.requests).toHaveLength(0);
    expect(eventNames(h.store)).toEqual(["email_final_rescue_canceled"]);
  });

  it("cancels a completed plan and a replaced plan version with no provider call", async () => {
    for (const state of [{ planComplete: true }, { currentPlanVersionId: "version-2" }]) {
      const h = harness({ state });
      const summary = await dispatchFinalRescueJobs(h.deps);
      expect(summary.outcomes[0]?.outcome).toBe("canceled");
      expect(h.adapter.requests).toHaveLength(0);
      expect(h.store.jobs.get("fr-job")?.status).toBe("canceled");
    }
  });

  it("suppresses unsubscribe, hard bounce and complaint with no provider call", async () => {
    for (const state of [
      { marketingUnsubscribedAt: "2026-02-05T09:00:00.000Z" },
      { emailSuppressedAt: "2026-02-05T09:00:00.000Z" },
      { suppressionListed: true },
    ]) {
      const h = harness({ state });
      const summary = await dispatchFinalRescueJobs(h.deps);
      expect(summary.outcomes[0]?.outcome).toBe("suppressed");
      expect(h.adapter.requests).toHaveLength(0);
      expect(h.store.jobs.get("fr-job")?.status).toBe("suppressed");
      expect(eventNames(h.store)).toEqual(["email_final_rescue_suppressed"]);
    }
  });

  it("defers behind Halfway without a provider attempt and without an event", async () => {
    const h = harness({ state: { halfwayPending: true } });
    const summary = await dispatchFinalRescueJobs(h.deps);

    expect(summary.outcomes[0]?.outcome).toBe("deferred");
    expect(h.adapter.requests).toHaveLength(0);
    expect(h.store.events).toHaveLength(0);
    expect(h.store.jobs.get("fr-job")?.status).toBe("retry_scheduled");
  });

  it("scopes the return credential to the logical Final Rescue job and stores only its hash", async () => {
    const h = harness();
    await dispatchFinalRescueJobs(h.deps);

    const token = h.store.returnTokens[0]!;
    expect(token.jobId).toBe("fr-job");
    expect(token.tokenHash).toBe(`hash:cred:open_plan:version-1:${finalRescueJobKey("version-1")}`);
    // Only a hash is persisted: no raw credential field is ever stored.
    expect(token.tokenHash.startsWith("hash:")).toBe(true);
    expect(Object.keys(token)).not.toContain("token");
  });
});

describe("F6 return exchange attribution and destination", () => {
  const job = {
    jobId: "fr-job",
    jobType: FINAL_RESCUE_JOB_TYPE,
    jobVersion: FINAL_RESCUE_JOB_VERSION,
    templateVersion: FINAL_RESCUE_TEMPLATE_VERSION,
    leadPlanId: "lead-1",
    planVersionId: "version-1",
  };

  it("attributes a deliberate open_plan exchange to the Final Rescue event", () => {
    expect(
      resolveLinkExchangeAttribution({
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job,
      }),
    ).toEqual({ eventName: FINAL_RESCUE_LINK_EXCHANGE_EVENT, jobId: "fr-job" });
  });

  it("keeps the general event for mismatched ownership, version or purpose", () => {
    for (const input of [
      { purpose: "recovery", leadPlanId: "lead-1", planVersionId: "version-1", job },
      {
        purpose: "open_plan",
        leadPlanId: "lead-2",
        planVersionId: "version-1",
        job,
      },
      {
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: "version-2",
        job,
      },
      {
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job: { ...job, jobVersion: "v2" },
      },
    ]) {
      expect(resolveLinkExchangeAttribution(input)).toEqual({
        eventName: PLAN_READY_LINK_EXCHANGE_EVENT,
        jobId: null,
      });
    }
  });

  it("always resolves the Final Rescue destination to the plan hub, never a day page", () => {
    expect(
      resolveReturnDestination({
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: "version-1",
        job,
      }),
    ).toBe(DEFAULT_RETURN_DESTINATION);
  });
});

describe("F7 Final Rescue outranks the lower inactivity messages", () => {
  it("controls only when a due unsent job exists and Halfway is not pending", () => {
    const due = "2026-02-05T13:00:00.000Z";
    expect(finalRescueDueControls(due, false, NOW)).toBe(true);
    expect(finalRescueDueControls(due, true, NOW)).toBe(false);
    expect(finalRescueDueControls(null, false, NOW)).toBe(false);
    expect(finalRescueDueControls("2026-02-06T12:00:00.000Z", false, NOW)).toBe(false);
  });

  it("cancels Start Day 1 once Final Rescue is accepted or due", () => {
    const base: StartDayOneState = {
      job: {
        job_id: "sd1",
        job_type: "start_day_1",
        job_version: "v1",
        template_version: "start_day_1_v1",
        lead_plan_id: "lead-1",
        plan_version_id: "version-1",
        eligible_at: "2026-02-02T12:00:00.000Z",
      },
      currentPlanVersionId: "version-1",
      hasRecipient: true,
      marketingUnsubscribedAt: null,
      emailSuppressedAt: null,
      suppressionListed: false,
      dayOneStartedAt: null,
      dayOneCompletedAt: null,
      planReadyAcceptedAt: PLAN_READY_ACCEPTED_AT,
      lastLifecycleAcceptedAt: null,
      acceptedInactivityCount: 0,
      halfwayPending: false,
      finalRescueAcceptedAt: null,
      finalRescueDueAt: null,
    };

    expect(resolveStartDayOne(base, NOW).action).toBe("START");
    expect(
      resolveStartDayOne({ ...base, finalRescueAcceptedAt: "2026-02-05T13:00:00.000Z" }, NOW),
    ).toMatchObject({ action: "CANCEL", reason: "final_rescue_sent", disposition: "cancel" });
    expect(
      resolveStartDayOne({ ...base, finalRescueDueAt: "2026-02-05T13:00:00.000Z" }, NOW),
    ).toMatchObject({ action: "CANCEL", reason: "final_rescue_controls" });
  });

  it("cancels Stalled once Final Rescue is accepted or due", () => {
    const base: StalledState = {
      job: {
        job_id: "stalled-1",
        job_type: "stalled",
        job_version: "v1",
        template_version: "stalled_v1",
        lead_plan_id: "lead-1",
        plan_version_id: "version-1",
        idempotency_key: stalledEpisodeKey("version-1", 2),
        eligible_at: "2026-02-04T12:00:00.000Z",
      },
      currentPlanVersionId: "version-1",
      hasRecipient: true,
      marketingUnsubscribedAt: null,
      emailSuppressedAt: null,
      suppressionListed: false,
      requiredCompletions: 2,
      totalRequiredAssignments: 7,
      planComplete: false,
      planCompletedControl: false,
      halfwayPending: false,
      finalRescueAccepted: false,
      finalRescueDueAt: null,
      latestRequiredCompletedDay: 2,
      episodeAnchorCompletedAt: "2026-02-02T12:00:00.000Z",
      planReadyAcceptedAt: PLAN_READY_ACCEPTED_AT,
      lastLifecycleAcceptedAt: null,
      acceptedInactivityCount: 0,
    };

    expect(resolveStalled(base, NOW)).toEqual({ action: "SEND" });
    expect(resolveStalled({ ...base, finalRescueAccepted: true }, NOW)).toEqual({
      action: "CANCEL",
      reason: "final_rescue_sent",
    });
    expect(resolveStalled({ ...base, finalRescueDueAt: "2026-02-05T13:00:00.000Z" }, NOW)).toEqual({
      action: "CANCEL",
      reason: "final_rescue_controls",
    });
  });
});
