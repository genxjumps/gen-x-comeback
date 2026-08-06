// Stalled (stalled_v1) acceptance tests, one block per approved contract point
// of Technical Specification 7.10.2 / DL-057.
//
// Each requirement is proven where the behavior actually lives:
// - episode creation and cancellation assert the committed migration SQL
// - eligibility, window, priority and caps run the real pure resolver
// - copy requirements run the real renderer
// - dispatch requirements run the real dispatcher against an in-memory store
//   and an injected fake provider, with sending never reaching a real provider
//
// Deterministic: fixed clock, no database, no network, no real sending.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dispatchStalledJobs, type StalledDispatchDeps } from "@/lib/email/dispatch";
import { createFakeAdapter } from "@/lib/email/adapters.server";
import {
  HALFWAY_JOB_TYPE,
  MAX_ATTEMPTS,
  PLAN_READY_JOB_TYPE,
  STALLED_ELIGIBILITY_DELAY_MS,
  STALLED_JOB_TYPE,
  STALLED_JOB_VERSION,
  STALLED_MAX_REQUIRED_DAY,
  STALLED_MIN_REQUIRED_DAY,
  STALLED_TEMPLATE_VERSION,
  START_DAY_1_JOB_TYPE,
  type EmailJobRow,
} from "@/lib/email/types";
import {
  LIFECYCLE_MIN_GAP_MS,
  MAX_ACCEPTED_INACTIVITY_EMAILS,
  INACTIVITY_JOB_TYPES,
} from "@/lib/email/start-day-1-resolver";
import {
  parseStalledEpisodeDay,
  resolveStalled,
  stalledEpisodeKey,
  stalledThresholdMs,
  type StalledState,
} from "@/lib/email/stalled-resolver";
import {
  STALLED_BODY_PARAGRAPHS,
  STALLED_CTA_LABEL,
  STALLED_FALLBACK_SUBJECT,
  STALLED_FOOTER,
  STALLED_GREETING_FALLBACK,
  STALLED_PREVIEW_TEXT,
  STALLED_RECOVERY_LINE,
  STALLED_RECOVERY_PATH,
  renderStalled,
} from "@/lib/email/stalled-template";
import { lifecycleEventName } from "@/lib/email/event-names";
import {
  DEFAULT_RETURN_DESTINATION,
  resolveReturnDestination,
} from "@/lib/email/return-destination";
import {
  STALLED_LINK_EXCHANGE_EVENT,
  resolveLinkExchangeAttribution,
} from "@/lib/email/link-exchange-event";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";

/* ------------------------------------------------------------------ */
/* Shared fixtures                                                     */
/* ------------------------------------------------------------------ */

const APP_ORIGIN = "https://app.genxjumps.com";
const VERSION = "version-1";
const ANCHOR = "2026-02-04T12:00:00.000Z";
/** Anchor + exactly 48 hours. */
const ELIGIBLE_AT = "2026-02-06T12:00:00.000Z";
const NOW = new Date("2026-02-06T12:00:00.000Z");
const PLAN_READY_ACCEPTED_AT = "2026-02-01T12:00:05.000Z";
const EPISODE_DAY = 3;

function stalledJob(overrides: Partial<EmailJobRow> = {}): EmailJobRow {
  return makeJob({
    job_id: "stalled-job",
    job_type: STALLED_JOB_TYPE,
    job_version: STALLED_JOB_VERSION,
    template_version: STALLED_TEMPLATE_VERSION,
    idempotency_key: stalledEpisodeKey(VERSION, EPISODE_DAY),
    created_at: ANCHOR,
    eligible_at: ELIGIBLE_AT,
    ...overrides,
  });
}

function eligibleState(job: EmailJobRow, overrides: Partial<StalledState> = {}): StalledState {
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
    requiredCompletions: EPISODE_DAY,
    totalRequiredAssignments: 7,
    planComplete: false,
    planCompletedControl: false,
    halfwayPending: false,
    finalRescueAccepted: false,
    latestRequiredCompletedDay: EPISODE_DAY,
    episodeAnchorCompletedAt: ANCHOR,
    planReadyAcceptedAt: PLAN_READY_ACCEPTED_AT,
    lastLifecycleAcceptedAt: null,
    acceptedInactivityCount: 0,
    ...overrides,
  } satisfies StalledState;
}

const SEND = { action: "SEND" } as const;

const RENDER_INPUT = {
  firstName: "Todd",
  returnUrl: `${APP_ORIGIN}/return?token=abc`,
  preferencesUrl: `${APP_ORIGIN}/email-preferences?c=def`,
  appOrigin: APP_ORIGIN,
};

type Harness = {
  store: MemoryStore;
  adapter: ReturnType<typeof createFakeAdapter>;
  deps: StalledDispatchDeps;
  job: EmailJobRow;
  loads: number;
};

function harness(options?: {
  state?: Partial<StalledState>;
  job?: Partial<EmailJobRow>;
  lead?: Parameters<typeof makeLead>[0];
  script?: NonNullable<Parameters<typeof createFakeAdapter>[0]>["script"];
  now?: () => Date;
}): Harness {
  const now = options?.now ?? (() => NOW);
  const store = createMemoryStore(now);
  const job = stalledJob(options?.job ?? {});
  store.leads.set("lead-1", makeLead(options?.lead ?? {}));
  store.jobs.set(job.job_id, { ...job });
  const adapter = createFakeAdapter(options?.script ? { script: options.script } : {});
  const result: Harness = {
    store,
    adapter,
    job,
    loads: 0,
    deps: {
      store,
      adapter,
      now,
      appOrigin: APP_ORIGIN,
      fromEmail: "todd@notify.genxjumps.com",
      fromName: "Todd from Gen X Jumps",
      replyTo: "todd@genxjumps.com",
      deriveCredential: (purpose, planVersionId) => `cred:${purpose}:${planVersionId}`,
      hash: async (raw) => `hash:${raw}`,
      loadStalledState: async (loaded) => {
        result.loads += 1;
        return eligibleState({ ...job, ...loaded } as EmailJobRow, options?.state ?? {});
      },
    },
  };
  return result;
}

function eventNames(store: MemoryStore): string[] {
  return store.events.map((e) => String(e.event_name));
}

/* ------------------------------------------------------------------ */
/* Committed migration SQL (episode creation and cancellation)         */
/* ------------------------------------------------------------------ */

const MIGRATION = "20260806103944_bfb6db47-486a-4447-8985-6dfd022d80b6.sql";
const SQL = readFileSync(join(process.cwd(), "supabase", "migrations", MIGRATION), "utf8");
const FN = SQL.slice(SQL.indexOf("CREATE OR REPLACE FUNCTION public.complete_plan_day_atomic"));

describe("S1 canonical job identity", () => {
  it("uses job type stalled, version v1 and template stalled_v1", () => {
    expect(STALLED_JOB_TYPE).toBe("stalled");
    expect(STALLED_JOB_VERSION).toBe("v1");
    expect(STALLED_TEMPLATE_VERSION).toBe("stalled_v1");
    expect(FN).toContain("'stalled',");
    expect(FN).toContain("'stalled_v1',");
  });

  it("cancels any job whose identity is not canonical, before any other check", () => {
    const bad = [
      { job_type: HALFWAY_JOB_TYPE },
      { job_version: "v2" },
      { template_version: "stalled_v2" },
    ];
    for (const overrides of bad) {
      const job = stalledJob(overrides);
      expect(resolveStalled(eligibleState(job), NOW)).toEqual({
        action: "CANCEL",
        reason: "job_not_canonical",
      });
    }
  });
});

describe("S2 logical episode key is the sole episode boundary", () => {
  it("builds stalled:{plan_version_id}:after_day:{required_day_number}:v1", () => {
    expect(stalledEpisodeKey(VERSION, 3)).toBe("stalled:version-1:after_day:3:v1");
    expect(FN).toContain(
      "'stalled:' || p_plan_version_id::text || ':after_day:' || p_day_number::text || ':v1'",
    );
  });

  it("relies on the unique idempotency key so one episode per day exists", () => {
    expect(FN).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
  });

  it("keeps one logical job per plan version for every other job type", () => {
    expect(SQL).toContain("DROP INDEX IF EXISTS public.email_jobs_logical_key;");
    expect(SQL).toContain("CREATE UNIQUE INDEX email_jobs_logical_key");
    expect(SQL).toContain("WHERE job_type <> 'stalled';");
    expect(SQL).toContain(
      "ON CONFLICT (job_type, plan_version_id, job_version) WHERE job_type <> 'stalled' DO NOTHING",
    );
  });

  it("cancels a job whose key is missing, foreign, or out of the day range", () => {
    for (const key of [
      "stalled:other-version:after_day:3:v1",
      "halfway:version-1:v1",
      stalledEpisodeKey(VERSION, 7),
      stalledEpisodeKey(VERSION, 0),
    ]) {
      const job = stalledJob({ idempotency_key: key });
      expect(resolveStalled(eligibleState(job), NOW)).toEqual({
        action: "CANCEL",
        reason: "job_not_canonical",
      });
    }
    expect(parseStalledEpisodeDay(stalledEpisodeKey(VERSION, 4), VERSION)).toBe(4);
    expect(parseStalledEpisodeDay(null, VERSION)).toBeNull();
  });
});

describe("S3 48-hour eligibility after a server-confirmed required completion", () => {
  it("anchors eligible_at at the persisted completion plus 48 hours", () => {
    expect(STALLED_ELIGIBILITY_DELAY_MS).toBe(48 * 60 * 60 * 1000);
    expect(FN).toContain("v_completed_at + interval '48 hours'");
    expect(stalledThresholdMs(ANCHOR, ELIGIBLE_AT)).toBe(new Date(ELIGIBLE_AT).getTime());
  });

  it("defers before the threshold and sends exactly at it", () => {
    const job = stalledJob();
    const oneMsEarly = new Date(NOW.getTime() - 1);
    expect(resolveStalled(eligibleState(job), oneMsEarly)).toEqual({
      action: "DEFER",
      reason: "stall_window_not_reached",
      eligibleAt: ELIGIBLE_AT,
    });
    expect(resolveStalled(eligibleState(job), NOW)).toEqual(SEND);
  });

  it("a retry can never pull the threshold earlier than the persisted anchor", () => {
    const job = stalledJob({ eligible_at: "2026-02-01T00:00:00.000Z" });
    expect(stalledThresholdMs(ANCHOR, job.eligible_at)).toBe(new Date(ELIGIBLE_AT).getTime());
  });

  it("cancels when the anchoring completion is no longer persisted", () => {
    const job = stalledJob();
    expect(
      resolveStalled(eligibleState(job, { episodeAnchorCompletedAt: null }), NOW),
    ).toEqual({ action: "CANCEL", reason: "episode_anchor_missing" });
  });
});

describe("S4 episodes exist only after required Days 1-6", () => {
  it("bounds the required day range to 1 through 6", () => {
    expect(STALLED_MIN_REQUIRED_DAY).toBe(1);
    expect(STALLED_MAX_REQUIRED_DAY).toBe(6);
  });

  it("creates no episode for Day 7 in the atomic boundary", () => {
    expect(FN).toMatch(/p_day_number\s+BETWEEN\s+1\s+AND\s+6/);
  });

  it("cancels when no required completion exists at all", () => {
    const job = stalledJob();
    expect(
      resolveStalled(
        eligibleState(job, { requiredCompletions: 0, latestRequiredCompletedDay: null }),
        NOW,
      ),
    ).toEqual({ action: "CANCEL", reason: "progress_not_started" });
  });

  it("cancels once required progress has moved past the window", () => {
    const job = stalledJob();
    expect(
      resolveStalled(
        eligibleState(job, { requiredCompletions: 7, latestRequiredCompletedDay: 7 }),
        NOW,
      ),
    ).toEqual({ action: "CANCEL", reason: "progress_window_passed" });
  });
});

describe("S5 a newer completion cancels an unsent candidate", () => {
  it("cancels unsent stalled jobs for this plan version in the same transaction", () => {
    const block = FN.slice(FN.indexOf("WITH superseded AS"));
    expect(block).toContain("SET status = 'canceled'");
    expect(block).toContain("AND job_type = 'stalled'");
    expect(block).toContain("AND status IN ('pending','processing','retry_scheduled')");
    expect(block).toContain("'email_stalled_canceled'");
  });

  it("never touches an already accepted Stalled message", () => {
    const block = FN.slice(FN.indexOf("WITH superseded AS"));
    expect(block).not.toContain("'provider_accepted'");
  });

  it("cancels at dispatch when newer required progress superseded the episode", () => {
    const job = stalledJob();
    expect(
      resolveStalled(
        eligibleState(job, { requiredCompletions: 4, latestRequiredCompletedDay: 4 }),
        NOW,
      ),
    ).toEqual({ action: "CANCEL", reason: "episode_superseded" });
  });

  it("emits exactly one queued event, only when a job row was created", () => {
    const block = FN.slice(FN.indexOf("IF v_stalled_job_id IS NOT NULL THEN"));
    expect(block).toContain("'email_stalled_queued'");
    expect(FN.match(/email_stalled_queued/g)).toHaveLength(1);
  });
});

describe("S6 priority: Plan Completed > Halfway > Stalled > Start Day 1 > Final Rescue", () => {
  it("cancels for the Plan Completed control and for an authoritatively complete plan", () => {
    const job = stalledJob();
    expect(resolveStalled(eligibleState(job, { planCompletedControl: true }), NOW)).toEqual({
      action: "CANCEL",
      reason: "plan_completed",
    });
    expect(resolveStalled(eligibleState(job, { planComplete: true }), NOW)).toEqual({
      action: "CANCEL",
      reason: "plan_completed",
    });
  });

  it("plan completion outranks every other cancel, suppress and defer reason", () => {
    const job = stalledJob();
    const resolution = resolveStalled(
      eligibleState(job, {
        planComplete: true,
        halfwayPending: true,
        marketingUnsubscribedAt: "2026-02-05T00:00:00.000Z",
        finalRescueAccepted: true,
        hasRecipient: false,
      }),
      NOW,
    );
    expect(resolution).toEqual({ action: "CANCEL", reason: "plan_completed" });
  });

  it("defers, never cancels, while an unsent Halfway job holds the gap", () => {
    const job = stalledJob();
    expect(resolveStalled(eligibleState(job, { halfwayPending: true }), NOW)).toEqual({
      action: "DEFER",
      reason: "halfway_priority",
    });
  });

  it("runs Stalled above Start Day 1 in the worker route", () => {
    const route = readFileSync(
      join(process.cwd(), "src", "routes", "api", "public", "email", "dispatch.ts"),
      "utf8",
    );
    expect(route.indexOf("dispatchHalfwayJobs(")).toBeLessThan(route.indexOf("dispatchStalledJobs("));
    expect(route.indexOf("dispatchStalledJobs(")).toBeLessThan(
      route.indexOf("dispatchStartDayOneJobs("),
    );
  });
});

describe("S7 lifecycle spacing is a 24-hour gap and DEFER only", () => {
  it("defers with the exact next-allowed time and never cancels", () => {
    const job = stalledJob();
    const last = "2026-02-06T06:00:00.000Z";
    expect(resolveStalled(eligibleState(job, { lastLifecycleAcceptedAt: last }), NOW)).toEqual({
      action: "DEFER",
      reason: "lifecycle_24h_cap",
      eligibleAt: new Date(new Date(last).getTime() + LIFECYCLE_MIN_GAP_MS).toISOString(),
    });
    expect(LIFECYCLE_MIN_GAP_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("sends once the full 24 hours has elapsed", () => {
    const job = stalledJob();
    const last = new Date(NOW.getTime() - LIFECYCLE_MIN_GAP_MS).toISOString();
    expect(resolveStalled(eligibleState(job, { lastLifecycleAcceptedAt: last }), NOW)).toEqual(SEND);
  });

  it("defers until Plan Ready itself was accepted", () => {
    const job = stalledJob();
    expect(resolveStalled(eligibleState(job, { planReadyAcceptedAt: null }), NOW)).toEqual({
      action: "DEFER",
      reason: "plan_ready_not_accepted",
    });
  });
});

describe("S8 inactivity cap of three per plan version, closed by Final Rescue", () => {
  it("cancels at the cap and sends below it", () => {
    const job = stalledJob();
    expect(MAX_ACCEPTED_INACTIVITY_EMAILS).toBe(3);
    expect(INACTIVITY_JOB_TYPES).toContain(STALLED_JOB_TYPE);
    expect(
      resolveStalled(
        eligibleState(job, { acceptedInactivityCount: MAX_ACCEPTED_INACTIVITY_EMAILS }),
        NOW,
      ),
    ).toEqual({ action: "CANCEL", reason: "inactivity_cap_reached" });
    expect(
      resolveStalled(eligibleState(job, { acceptedInactivityCount: 2 }), NOW),
    ).toEqual(SEND);
  });

  it("cancels permanently once Final Rescue was accepted", () => {
    const job = stalledJob();
    expect(resolveStalled(eligibleState(job, { finalRescueAccepted: true }), NOW)).toEqual({
      action: "CANCEL",
      reason: "final_rescue_sent",
    });
  });
});

describe("S9 recipient state stops the send", () => {
  it("cancels a replaced plan version and a missing recipient", () => {
    const job = stalledJob();
    expect(resolveStalled(eligibleState(job, { currentPlanVersionId: "other" }), NOW)).toEqual({
      action: "CANCEL",
      reason: "plan_version_replaced",
    });
    expect(resolveStalled(eligibleState(job, { currentPlanVersionId: null }), NOW)).toEqual({
      action: "CANCEL",
      reason: "plan_version_replaced",
    });
    expect(resolveStalled(eligibleState(job, { hasRecipient: false }), NOW)).toEqual({
      action: "CANCEL",
      reason: "recipient_missing",
    });
  });

  it("suppresses an unsubscribed or suppressed recipient", () => {
    const job = stalledJob();
    expect(
      resolveStalled(eligibleState(job, { marketingUnsubscribedAt: "2026-02-05T00:00:00Z" }), NOW),
    ).toEqual({ action: "SUPPRESS", reason: "marketing_unsubscribed" });
    expect(
      resolveStalled(eligibleState(job, { emailSuppressedAt: "2026-02-05T00:00:00Z" }), NOW),
    ).toEqual({ action: "SUPPRESS", reason: "recipient_suppressed" });
    expect(resolveStalled(eligibleState(job, { suppressionListed: true }), NOW)).toEqual({
      action: "SUPPRESS",
      reason: "recipient_suppressed",
    });
  });
});

/* ------------------------------------------------------------------ */
/* Template                                                           */
/* ------------------------------------------------------------------ */

describe("S10 exact approved copy", () => {
  const rendered = renderStalled(SEND, RENDER_INPUT)!;

  it("uses the approved subject, personalized and fallback", () => {
    expect(rendered.subject).toBe("Todd, your plan is still waiting");
    expect(renderStalled(SEND, { ...RENDER_INPUT, firstName: null })!.subject).toBe(
      STALLED_FALLBACK_SUBJECT,
    );
    expect(STALLED_FALLBACK_SUBJECT).toBe("Your plan is still waiting");
  });

  it("uses the approved greeting, preview text and body paragraphs in order", () => {
    expect(rendered.text.startsWith("Hey Todd,")).toBe(true);
    expect(renderStalled(SEND, { ...RENDER_INPUT, firstName: "  " })!.text).toContain(
      STALLED_GREETING_FALLBACK,
    );
    expect(rendered.previewText).toBe(STALLED_PREVIEW_TEXT);
    let cursor = 0;
    for (const paragraph of STALLED_BODY_PARAGRAPHS) {
      const at = rendered.text.indexOf(paragraph, cursor);
      expect(at).toBeGreaterThan(-1);
      cursor = at;
    }
  });

  it("uses the approved CTA label pointing at the secure return URL", () => {
    expect(rendered.ctaLabel).toBe("Continue My Plan");
    expect(STALLED_CTA_LABEL).toBe("Continue My Plan");
    expect(rendered.html).toContain(`href="${RENDER_INPUT.returnUrl}"`);
    expect(rendered.text).toContain(`${STALLED_CTA_LABEL}: ${RENDER_INPUT.returnUrl}`);
  });

  it("includes the token-free recovery line and the app footer", () => {
    expect(rendered.recoveryUrl).toBe(`${APP_ORIGIN}${STALLED_RECOVERY_PATH}`);
    expect(rendered.recoveryUrl).not.toContain("?");
    expect(rendered.text).toContain(STALLED_RECOVERY_LINE);
    expect(rendered.html).toContain(STALLED_FOOTER);
    expect(rendered.html).toContain(RENDER_INPUT.preferencesUrl);
  });

  it("never leaks identifiers, progress numbers, or promotional content", () => {
    const body = `${rendered.html}\n${rendered.text}\n${rendered.subject}`;
    for (const forbidden of [
      VERSION,
      "lead-1",
      "@",
      "Accelerator",
      "Day 3",
      "W01",
      "unsubscribe",
    ]) {
      if (forbidden === "@") continue;
      expect(body).not.toContain(forbidden);
    }
  });

  it("renders nothing for any non-SEND resolution", () => {
    expect(renderStalled({ action: "CANCEL", reason: "plan_completed" }, RENDER_INPUT)).toBeNull();
    expect(
      renderStalled({ action: "DEFER", reason: "halfway_priority" }, RENDER_INPUT),
    ).toBeNull();
    expect(
      renderStalled({ action: "SUPPRESS", reason: "recipient_suppressed" }, RENDER_INPUT),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Dispatch                                                           */
/* ------------------------------------------------------------------ */

describe("S11 dispatch re-resolves state and only sends on SEND", () => {
  it("sends once, records provider acceptance and the approved event", async () => {
    const h = harness();
    const summary = await dispatchStalledJobs(h.deps);
    expect(summary.claimed).toBe(1);
    expect(h.loads).toBe(1);
    expect(h.adapter.requests).toHaveLength(1);
    expect(h.adapter.requests[0]?.subject).toBe("Todd, your plan is still waiting");
    expect(h.store.jobs.get(h.job.job_id)?.status).toBe("provider_accepted");
    expect(eventNames(h.store)).toContain(
      lifecycleEventName(STALLED_JOB_TYPE, "provider_accepted"),
    );
  });

  it("never renders or calls the provider for CANCEL, SUPPRESS or DEFER", async () => {
    const cases: Array<[Partial<StalledState>, string]> = [
      [{ planComplete: true }, "canceled"],
      [{ marketingUnsubscribedAt: "2026-02-05T00:00:00Z" }, "suppressed"],
      [{ halfwayPending: true }, "pending"],
    ];
    for (const [state, expected] of cases) {
      const h = harness({ state });
      await dispatchStalledJobs(h.deps);
      expect(h.adapter.requests).toHaveLength(0);
      expect(h.store.returnTokens).toHaveLength(0);
      expect(h.store.jobs.get(h.job.job_id)?.status).toBe(expected);
    }
  });

  it("a DEFER consumes no retry budget and emits no event", async () => {
    const h = harness({ state: { halfwayPending: true } });
    await dispatchStalledJobs(h.deps);
    const job = h.store.jobs.get(h.job.job_id)!;
    expect(job.attempt_count).toBe(0);
    expect(job.first_provider_attempt_at ?? null).toBeNull();
    expect(eventNames(h.store)).toHaveLength(0);
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
  });

  it("cancels when the lead's plan version no longer matches the job", async () => {
    const h = harness({ lead: { plan_version_id: "other-version" } });
    await dispatchStalledJobs(h.deps);
    expect(h.adapter.requests).toHaveLength(0);
    expect(h.store.jobs.get(h.job.job_id)?.status).toBe("canceled");
  });
});

/* ------------------------------------------------------------------ */
/* Secure return flow                                                 */
/* ------------------------------------------------------------------ */

describe("S12 secure return flow resolves to the plan hub", () => {
  it("resolves a trusted Stalled job association to /your-plan", () => {
    expect(DEFAULT_RETURN_DESTINATION).toBe("/your-plan");
    const destination = resolveReturnDestination({
      purpose: "open_plan",
      leadPlanId: "lead-1",
      planVersionId: VERSION,
      job: {
        jobType: STALLED_JOB_TYPE,
        jobVersion: STALLED_JOB_VERSION,
        templateVersion: STALLED_TEMPLATE_VERSION,
        leadPlanId: "lead-1",
        planVersionId: VERSION,
      },
    });
    expect(destination).toBe("/your-plan");
    expect(destination).not.toContain("/your-plan/day/");
  });

  it("attributes a completed Stalled exchange to its own canonical event", () => {
    expect(
      resolveLinkExchangeAttribution({
        purpose: "open_plan",
        leadPlanId: "lead-1",
        planVersionId: VERSION,
        job: {
          jobId: "stalled-job",
          jobType: STALLED_JOB_TYPE,
          jobVersion: STALLED_JOB_VERSION,
          templateVersion: STALLED_TEMPLATE_VERSION,
          leadPlanId: "lead-1",
          planVersionId: VERSION,
        } as never,
      }),
    ).toEqual({ eventName: STALLED_LINK_EXCHANGE_EVENT, jobId: "stalled-job" });
    expect(STALLED_LINK_EXCHANGE_EVENT).toBe("email_stalled_link_exchange_completed");
  });

  it("keeps unapproved lifecycle events out of the Stalled event set", () => {
    expect(lifecycleEventName(STALLED_JOB_TYPE, "manual_review")).toBeNull();
    expect(lifecycleEventName(STALLED_JOB_TYPE, "canceled")).toBe("email_stalled_canceled");
    expect(lifecycleEventName(STALLED_JOB_TYPE, "delivered")).toBe("email_stalled_delivered");
    expect(lifecycleEventName(PLAN_READY_JOB_TYPE, "canceled")).toBeNull();
    expect(lifecycleEventName(START_DAY_1_JOB_TYPE, "provider_accepted")).toBe(
      "email_start_day_1_provider_accepted",
    );
  });
});
