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
  FINAL_RESCUE_FOOTER,
  FINAL_RESCUE_GREETING_FALLBACK,
  FINAL_RESCUE_RECOVERY_LINE,
  FINAL_RESCUE_RECOVERY_PATH,
  FINAL_RESCUE_SIGN_OFF,
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
import { requiredDayNumbers } from "@/lib/email/halfway-state.server";
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
  const RETURN_URL = "https://app.genxjumps.com/return?t=secret-token";
  const PREFERENCES_URL = "https://app.genxjumps.com/email-preferences?t=pref-token";

  const rendered = (variant: "unstarted" | "started", firstName: string | null = "Todd") =>
    renderFinalRescue(
      { action: "SEND", variant },
      {
        firstName,
        returnUrl: RETURN_URL,
        preferencesUrl: PREFERENCES_URL,
        appOrigin: "https://app.genxjumps.com",
      },
    )!;

  /** Every customer-facing surface of one rendered message, combined. */
  function customerFacingSurface(out: ReturnType<typeof rendered>): string {
    return [
      out.subject,
      out.previewText,
      out.ctaLabel,
      out.postCtaLine,
      out.recoveryUrl,
      out.text,
      out.html,
      FINAL_RESCUE_RECOVERY_LINE,
      FINAL_RESCUE_FOOTER,
      ...FINAL_RESCUE_SIGN_OFF,
    ].join("\n");
  }

  it("renders the exact approved unstarted copy: subject, preview, body, CTA and post-CTA", () => {
    const out = rendered("unstarted");
    expect(out.variant).toBe("unstarted");
    expect(out.subject).toBe("Todd, your 7-day plan is still waiting");
    expect(out.personalizedName).toBe("Todd");
    expect(out.previewText).toBe("Come back to your plan and start Day 1 when you\u2019re ready.");
    expect(out.ctaLabel).toBe("Open My Plan");
    expect(out.postCtaLine).toBe("One workout. One decision. Get moving again.");
    expect(FINAL_RESCUE_COPY.unstarted.bodyParagraphs).toEqual([
      "Your 7-Day Comeback Plan is still here.",
      "You don\u2019t need to catch up or start over. Open your plan and start Day 1 when you\u2019re ready.",
    ]);
    // Greeting plus every approved paragraph, in order, in both renderings.
    expect(out.text).toContain("Hey Todd,");
    for (const paragraph of FINAL_RESCUE_COPY.unstarted.bodyParagraphs) {
      expect(out.text).toContain(paragraph);
      expect(out.html).toContain(paragraph.replace(/'/g, "&#39;"));
    }
    expect(out.text).toContain(`Open My Plan: ${RETURN_URL}`);
    expect(out.text).toContain("One workout. One decision. Get moving again.");
  });

  it("renders the exact approved started copy: subject, preview, body, CTA and post-CTA", () => {
    const out = rendered("started");
    expect(out.variant).toBe("started");
    expect(out.subject).toBe("Todd, pick up where you left off");
    expect(out.personalizedName).toBe("Todd");
    expect(out.previewText).toBe("Your plan and progress are saved.");
    expect(out.ctaLabel).toBe("Return to My Plan");
    expect(out.postCtaLine).toBe("The next step is the only one that matters.");
    expect(FINAL_RESCUE_COPY.started.bodyParagraphs).toEqual([
      "You started your 7-Day Comeback Plan, but it\u2019s been a few days since you completed a day in your plan.",
      "Your progress is saved. You don\u2019t need to restart or make up missed days. Open your plan and complete the next day.",
    ]);
    expect(out.text).toContain("Hey Todd,");
    for (const paragraph of FINAL_RESCUE_COPY.started.bodyParagraphs) {
      expect(out.text).toContain(paragraph);
      expect(out.html).toContain(paragraph.replace(/'/g, "&#39;"));
    }
    expect(out.text).toContain(`Return to My Plan: ${RETURN_URL}`);
    expect(out.text).toContain("The next step is the only one that matters.");
  });

  it("uses the exact approved fallback subject and impersonal greeting for both variants", () => {
    expect(FINAL_RESCUE_GREETING_FALLBACK).toBe("Hey there,");
    const unstarted = rendered("unstarted", null);
    expect(unstarted.subject).toBe("Your 7-day plan is still waiting");
    expect(unstarted.personalizedName).toBeNull();
    expect(unstarted.text).toContain("Hey there,");
    expect(unstarted.text).not.toContain("Hey Todd,");

    const started = rendered("started", null);
    expect(started.subject).toBe("Pick up where you left off");
    expect(started.personalizedName).toBeNull();
    expect(started.text).toContain("Hey there,");
  });

  it("never uses the word assignment in any customer-facing output, in any variant", () => {
    for (const [variant, name] of [
      ["unstarted", "Todd"],
      ["unstarted", null],
      ["started", "Todd"],
      ["started", null],
    ] as const) {
      const surface = customerFacingSurface(rendered(variant, name));
      expect(surface.toLowerCase()).not.toContain("assignment");
    }
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
      expect(rendered(variant).text).toContain(`Manage email preferences: ${PREFERENCES_URL}`);
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

describe("F8 only deliberate first-time persisted progress moves the horizon", () => {
  /** Body of one function definition inside the committed migration. */
  function functionBody(signature: string): string {
    const start = MIGRATION.indexOf(signature);
    expect(start).toBeGreaterThan(-1);
    const end = MIGRATION.indexOf("$function$;", start);
    expect(end).toBeGreaterThan(start);
    return MIGRATION.slice(start, end);
  }

  const MARK_START = functionBody("CREATE OR REPLACE FUNCTION public.mark_day_1_started");
  const COMPLETE = functionBody("CREATE OR REPLACE FUNCTION public.complete_plan_day_atomic");
  const COMMIT = functionBody("CREATE OR REPLACE FUNCTION public.commit_plan_version");

  it("re-anchors on a Day 1 start only inside the newly inserted branch", () => {
    const newlyInserted = MARK_START.indexOf("IF v_started_at IS NOT NULL THEN");
    const reanchor = MARK_START.indexOf("eligible_at = v_started_at + interval '5 days'");
    const branchEnd = MARK_START.indexOf("RETURN QUERY SELECT v_started_at, true;");
    expect(newlyInserted).toBeGreaterThan(-1);
    expect(reanchor).toBeGreaterThan(newlyInserted);
    expect(reanchor).toBeLessThan(branchEnd);
    // The insert that governs that branch only yields a row when it is new.
    expect(MARK_START).toContain("ON CONFLICT (plan_version_id, day_number) DO NOTHING");
    expect(MARK_START).toContain(
      "RETURNING lead_plan_day_starts.started_at INTO v_started_at",
    );
  });

  it("leaves the replayed Day 1 start branch with only the persisted read and return", () => {
    const replayBranch = MARK_START.slice(
      MARK_START.indexOf("RETURN QUERY SELECT v_started_at, true;"),
    );
    expect(replayBranch).toContain("FROM public.lead_plan_day_starts AS day_start");
    expect(replayBranch).toContain("RETURN QUERY SELECT v_started_at, false;");
    // No Final Rescue write of any kind is reachable from the replay path.
    expect(replayBranch).not.toContain("final_rescue");
    expect(replayBranch).not.toContain("email_jobs");
  });

  it("gates every Final Rescue completion write behind a newly inserted required completion", () => {
    const insert = COMPLETE.indexOf("INSERT INTO public.lead_plan_day_completions");
    const insertedFlag = COMPLETE.indexOf("v_inserted := v_completed_at IS NOT NULL;");
    const guard = COMPLETE.indexOf("IF v_inserted THEN");
    const reanchor = COMPLETE.indexOf("eligible_at = v_completed_at + interval '5 days'");
    const cancel = COMPLETE.indexOf("'email_final_rescue_canceled'");

    expect(COMPLETE).toContain("ON CONFLICT (lead_plan_id, day_number) DO NOTHING");
    expect(insertedFlag).toBeGreaterThan(insert);
    expect(guard).toBeGreaterThan(insertedFlag);
    expect(reanchor).toBeGreaterThan(guard);
    expect(cancel).toBeGreaterThan(guard);

    // A replayed completion reloads the existing timestamp and clears the flag,
    // so nothing outside the guarded block can touch the Final Rescue job.
    expect(COMPLETE).toContain("IF NOT v_inserted THEN");
    const outsideGuard = COMPLETE.slice(0, guard);
    expect(outsideGuard).not.toContain("final_rescue");
  });

  it("derives required days only from top-level plan_json.days, so nested optional sessions never re-anchor", () => {
    expect(COMPLETE).toContain("jsonb_array_elements(COALESCE(v_plan->'days', '[]'::jsonb))");
    expect(COMPLETE).toContain("IF v_required IS NULL OR NOT (p_day_number = ANY(v_required)) THEN");
    // Validation against v_required happens before the completion insert, hence
    // before v_inserted and before any Final Rescue write.
    const validation = COMPLETE.indexOf("IF v_required IS NULL OR NOT");
    expect(validation).toBeLessThan(COMPLETE.indexOf("INSERT INTO public.lead_plan_day_completions"));
    // No nested optional session is ever read as a required day number.
    expect(COMPLETE).not.toContain("'optional'");
    expect(COMPLETE).not.toContain("->'optional'");

    // The same rule in the shared TypeScript helper: a top-level recovery day
    // with a nested optional W07 session contributes exactly one required day.
    expect(
      requiredDayNumbers({
        days: [
          { day: 6, workout: { id: "W03" } },
          { day: 7, optional: { id: "W07" } },
        ],
      }),
    ).toEqual([6, 7]);
  });

  it("treats a required top-level recovery day exactly like a workout day", () => {
    // The derivation reads only the day number and ordinality: no activity kind,
    // workout id, recovery flag, or client-supplied field takes part.
    const derivation = COMPLETE.slice(
      COMPLETE.indexOf("SELECT array_agg(day_number ORDER BY day_number) INTO v_required"),
      COMPLETE.indexOf("IF v_required IS NULL OR NOT"),
    );
    expect(derivation).toContain("COALESCE((d.value->>'day')::smallint, d.ordinality::smallint)");
    for (const field of ["kind", "activity", "type", "workout", "recovery", "optional"]) {
      expect(derivation).not.toContain(field);
    }
    // And the re-anchor boundary itself depends only on the persisted
    // newly-inserted completion timestamp, never on the day's content.
    expect(COMPLETE).toContain("eligible_at = v_completed_at + interval '5 days'");
  });

  it("cancels the replaced plan version's unsent Final Rescue job before the new version is committed", () => {
    const cancelAllUnsent = COMMIT.indexOf(
      "WHERE plan_version_id = v_lead.plan_version_id\n        AND status IN ('pending','processing','retry_scheduled')",
    );
    const reassessment = COMMIT.indexOf("v_source := 'reassessment';");
    const newJob = COMMIT.indexOf("'final_rescue', 'v1', 'final_rescue_v1'");

    expect(reassessment).toBeGreaterThan(-1);
    expect(cancelAllUnsent).toBeGreaterThan(reassessment);
    // The cancellation runs on the replaced version, before the new version's
    // own Final Rescue job is created later in the same transaction.
    expect(cancelAllUnsent).toBeLessThan(newJob);
    expect(COMMIT).toContain("SET status = 'canceled', canceled_at = v_now");
    // No Final Rescue special-casing is needed: the cancellation is type-agnostic.
    const cancelStatement = COMMIT.slice(
      COMMIT.indexOf("UPDATE public.email_jobs", reassessment),
      cancelAllUnsent + 120,
    );
    expect(cancelStatement).not.toContain("job_type");
  });
});
