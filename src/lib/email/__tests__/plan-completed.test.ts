// Acceptance tests for the Plan Completed lifecycle (plan_completed_v1).
//
// Deterministic and offline: fixed clock, in-memory store, injected fake
// provider, injected authoritative state loader, and assertions against the
// committed migration SQL for database-boundary behavior — the same mechanism
// already used for Halfway, Stalled, and Final Rescue. No database, no network,
// no sending.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dispatchPlanCompletedJobs, type PlanCompletedDispatchDeps } from "@/lib/email/dispatch";
import { createFakeAdapter } from "@/lib/email/adapters.server";
import {
  FINAL_RESCUE_JOB_TYPE,
  HALFWAY_JOB_TYPE,
  PLAN_COMPLETED_JOB_TYPE,
  PLAN_COMPLETED_JOB_VERSION,
  PLAN_COMPLETED_TEMPLATE_VERSION,
  PLAN_READY_JOB_TYPE,
  STALLED_JOB_TYPE,
  START_DAY_1_JOB_TYPE,
  planCompletedJobKey,
  type EmailJobRow,
} from "@/lib/email/types";
import { resolvePlanCompleted, type PlanCompletedState } from "@/lib/email/plan-completed-resolver";
import {
  PLAN_COMPLETED_BODY_PARAGRAPHS,
  PLAN_COMPLETED_CTA_LABEL,
  PLAN_COMPLETED_FALLBACK_SUBJECT,
  PLAN_COMPLETED_FOOTER,
  PLAN_COMPLETED_GREETING_FALLBACK,
  PLAN_COMPLETED_POST_CTA_LINE,
  PLAN_COMPLETED_PREVIEW_TEXT,
  PLAN_COMPLETED_RECOVERY_LINE,
  PLAN_COMPLETED_RECOVERY_PATH,
  PLAN_COMPLETED_SIGN_OFF,
  renderPlanCompleted,
} from "@/lib/email/plan-completed-template";
import {
  LIFECYCLE_MIN_GAP_MS,
  MAX_ACCEPTED_INACTIVITY_EMAILS,
} from "@/lib/email/start-day-1-resolver";
import { INACTIVITY_JOB_TYPES } from "@/lib/email/start-day-1-resolver";
import {
  PLAN_COMPLETED_LINK_EXCHANGE_EVENT,
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

const NOW = new Date("2026-02-08T18:00:00.000Z");
/** Persisted final required completion timestamp: immediately eligible. */
const COMPLETED_AT = "2026-02-08T12:00:00.000Z";
const PLAN_READY_ACCEPTED_AT = "2026-02-01T12:00:05.000Z";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const MIGRATION = readFileSync(
  join(MIGRATIONS_DIR, "20260806200433_cd9cb476-5061-494a-a66e-8e10b0f31dd5.sql"),
  "utf8",
);

/** Reassessment cancellation lives in the committed commit_plan_version body. */
const REASSESSMENT_MIGRATION = readFileSync(
  join(MIGRATIONS_DIR, "20260806175920_582a324d-47f9-44ac-aec4-1ad8b86eb7d6.sql"),
  "utf8",
);

const DISPATCH_ROUTE = readFileSync(
  join(process.cwd(), "src", "routes", "api", "public", "email", "dispatch.ts"),
  "utf8",
);

function completedJob(overrides: Partial<EmailJobRow> = {}): EmailJobRow {
  return makeJob({
    job_id: "pc-job",
    job_type: PLAN_COMPLETED_JOB_TYPE,
    job_version: PLAN_COMPLETED_JOB_VERSION,
    template_version: PLAN_COMPLETED_TEMPLATE_VERSION,
    idempotency_key: planCompletedJobKey("version-1"),
    created_at: COMPLETED_AT,
    eligible_at: COMPLETED_AT,
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
  overrides: Partial<PlanCompletedState> = {},
): PlanCompletedState {
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
    planComplete: true,
    planCompletedAcceptedAt: null,
    planReadyAcceptedAt: PLAN_READY_ACCEPTED_AT,
    lastLifecycleAcceptedAt: null,
    ...overrides,
  } satisfies PlanCompletedState;
}

type Harness = {
  store: MemoryStore;
  adapter: ReturnType<typeof createFakeAdapter>;
  deps: PlanCompletedDispatchDeps;
  job: EmailJobRow;
};

function harness(options?: {
  state?: Partial<PlanCompletedState>;
  job?: Partial<EmailJobRow>;
  adapter?: Parameters<typeof createFakeAdapter>[0];
  now?: () => Date;
}): Harness {
  const now = options?.now ?? (() => NOW);
  const store = createMemoryStore(now);
  const job = completedJob(options?.job ?? {});
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
      loadPlanCompletedState: async (loaded) => sendableState(loaded, options?.state ?? {}),
    },
  };
}

function eventNames(store: MemoryStore): string[] {
  return store.events.map((e) => e.event_name);
}

describe("P1 locked Plan Completed identity", () => {
  it("uses the canonical job type, version, template version and logical key", () => {
    expect(PLAN_COMPLETED_JOB_TYPE).toBe("plan_completed");
    expect(PLAN_COMPLETED_JOB_VERSION).toBe("v1");
    expect(PLAN_COMPLETED_TEMPLATE_VERSION).toBe("plan_completed_v1");
    expect(planCompletedJobKey("version-1")).toBe("plan_completed:version-1:v1");
  });

  it("emits the approved canonical event names and omits manual review", () => {
    expect(lifecycleEventName(PLAN_COMPLETED_JOB_TYPE, "provider_accepted")).toBe(
      "email_plan_completed_provider_accepted",
    );
    expect(lifecycleEventName(PLAN_COMPLETED_JOB_TYPE, "delivered")).toBe(
      "email_plan_completed_delivered",
    );
    expect(lifecycleEventName(PLAN_COMPLETED_JOB_TYPE, "canceled")).toBe(
      "email_plan_completed_canceled",
    );
    expect(lifecycleEventName(PLAN_COMPLETED_JOB_TYPE, "suppressed")).toBe(
      "email_plan_completed_suppressed",
    );
    expect(lifecycleEventName(PLAN_COMPLETED_JOB_TYPE, "manual_review")).toBeNull();
  });

  it("is never an inactivity email, so the three-email cap cannot apply", () => {
    expect(INACTIVITY_JOB_TYPES as readonly string[]).not.toContain(PLAN_COMPLETED_JOB_TYPE);
    expect(MAX_ACCEPTED_INACTIVITY_EMAILS).toBe(3);
  });
});

describe("P2 authoritative completion boundary at the database boundary", () => {
  it("creates exactly one immediately eligible job with the canonical identity", () => {
    expect(MIGRATION).toContain("'plan_completed:' || p_plan_version_id::text || ':v1'");
    expect(MIGRATION).toContain("'plan_completed_v1'");
    expect(MIGRATION).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    // Eligible at, created_at and updated_at are all the persisted final
    // required completion timestamp: no delay and no calendar-time input.
    const insert = MIGRATION.slice(MIGRATION.indexOf("'plan_completed',"));
    expect(insert.slice(0, 400)).toContain("v_completed_at,\n      'pending',");
  });

  it("creates the job only for a newly persisted final required completion", () => {
    expect(MIGRATION).toContain(
      "IF v_inserted AND v_count >= COALESCE(array_length(v_required, 1), 0) THEN",
    );
  });

  it("emits exactly one queued event, only when the row was actually inserted", () => {
    expect(MIGRATION).toContain("IF v_plan_completed_job_id IS NOT NULL THEN");
    const queued = MIGRATION.match(/'email_plan_completed_queued'/g) ?? [];
    expect(queued).toHaveLength(1);
  });

  it("derives required days only from top-level plan_json.days, so nested optional W07 never counts", () => {
    expect(MIGRATION).toContain("jsonb_array_elements(COALESCE(v_plan->'days', '[]'::jsonb))");
    // The shared required-day derivation used by every loader agrees: a nested
    // optional session contributes no required day number, and a shorter plan
    // completes on its own last required day.
    const shorterPlan = {
      days: [
        { day: 1, kind: "workout" },
        { day: 2, kind: "walking" },
        { day: 3, kind: "recovery", optional: { kind: "active_recovery" } },
        { day: 4, kind: "active_recovery" },
        { day: 5, kind: "workout", optional: { kind: "w07" } },
      ],
    };
    expect(requiredDayNumbers(shorterPlan)).toEqual([1, 2, 3, 4, 5]);
  });

  it("treats workout, walking, recovery and assigned Active Recovery days identically", () => {
    // Every top-level day is a required day regardless of its kind: the boundary
    // is the count of required day numbers, never the assignment kind.
    const plan = {
      days: [
        { day: 1, kind: "workout" },
        { day: 2, kind: "walking" },
        { day: 3, kind: "recovery" },
        { day: 4, kind: "active_recovery" },
      ],
    };
    expect(requiredDayNumbers(plan)).toEqual([1, 2, 3, 4]);
    expect(MIGRATION).not.toContain("kind =");
  });

  it("cancels every unsent lower-priority job in the same transaction and releases leases", () => {
    expect(MIGRATION).toContain(
      "AND job_type IN ('start_day_1','halfway','stalled','final_rescue')",
    );
    const block = MIGRATION.slice(
      MIGRATION.indexOf("AND job_type IN ('start_day_1','halfway','stalled','final_rescue')") - 900,
    ).slice(0, 1400);
    expect(block).toContain("status IN ('pending','processing','retry_scheduled')");
    expect(block).toContain("claim_token = NULL");
    expect(block).toContain("locked_at = NULL");
    expect(block).toContain("lease_expires_at = NULL");
    expect(block).toContain("next_attempt_at = NULL");
    // Accepted jobs and their history are never touched.
    expect(block).toContain("provider_accepted_at IS NULL");
  });

  it("records canonical cancellation events for the closed lower-priority jobs", () => {
    expect(MIGRATION).toContain("SELECT 'email_' || closed.job_type || '_canceled', 'v1'");
    for (const jobType of [
      START_DAY_1_JOB_TYPE,
      HALFWAY_JOB_TYPE,
      STALLED_JOB_TYPE,
      FINAL_RESCUE_JOB_TYPE,
    ]) {
      expect(lifecycleEventName(jobType, "canceled")).toBe(`email_${jobType}_canceled`);
    }
  });

  it("preserves the existing signature, return shape, security and grants", () => {
    expect(MIGRATION).toContain(
      "complete_plan_day_atomic(p_lead_plan_id uuid, p_plan_version_id uuid, p_day_number smallint)",
    );
    expect(MIGRATION).toContain(
      "RETURNS TABLE(required_completions integer, halfway_job_id uuid, halfway_queued boolean)",
    );
    expect(MIGRATION).toContain("RETURN QUERY SELECT v_count, v_job_id, v_job_id IS NOT NULL;");
    expect(MIGRATION).toContain("SECURITY DEFINER");
    expect(MIGRATION).toContain("SET search_path TO 'public'");
    expect(MIGRATION).toContain(
      "GRANT EXECUTE ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint)",
    );
    // Halfway, Stalled and Final Rescue behavior is preserved verbatim.
    expect(MIGRATION).toContain("'email_halfway_queued'");
    expect(MIGRATION).toContain("'email_stalled_queued'");
    expect(MIGRATION).toContain("eligible_at = v_completed_at + interval '5 days'");
  });

  it("does not backfill existing completed plans", () => {
    expect(MIGRATION).not.toMatch(/INSERT INTO public\.email_jobs[\s\S]{0,400}SELECT/);
  });

  it("cancels an unsent Plan Completed job on reassessment, type-agnostically", () => {
    const cancelBlock = REASSESSMENT_MIGRATION.slice(
      REASSESSMENT_MIGRATION.indexOf("UPDATE public.email_jobs\n      SET status = 'canceled'"),
    ).slice(0, 500);
    expect(cancelBlock).toContain("WHERE plan_version_id = v_lead.plan_version_id");
    expect(cancelBlock).toContain("AND status IN ('pending','processing','retry_scheduled')");
    // No job_type filter: every unsent job of the replaced version is canceled,
    // which includes a Plan Completed job.
    expect(cancelBlock.slice(0, cancelBlock.indexOf("AND status IN"))).not.toContain("job_type");
  });
});

describe("P3 resolver derives every outcome from persisted state only", () => {
  const job = completedJob();

  it("sends when the plan is complete, current, eligible and Plan Ready was accepted", () => {
    expect(resolvePlanCompleted(sendableState(job), NOW)).toEqual({ action: "SEND" });
  });

  it("cancels permanently for non-applicable state", () => {
    const cases: Array<[Partial<PlanCompletedState>, string]> = [
      [{ currentPlanVersionId: "version-2" }, "plan_version_replaced"],
      [{ currentPlanVersionId: null }, "plan_version_replaced"],
      [{ planComplete: false }, "plan_incomplete"],
      [{ planCompletedAcceptedAt: "2026-02-08T13:00:00.000Z" }, "already_sent"],
      [{ hasRecipient: false }, "recipient_missing"],
    ];
    for (const [overrides, reason] of cases) {
      expect(resolvePlanCompleted(sendableState(job, overrides), NOW)).toEqual({
        action: "CANCEL",
        reason,
      });
    }
  });

  it("cancels a non-canonical job identity, including a mismatched key", () => {
    for (const override of [
      { job_type: "halfway" },
      { job_version: "v2" },
      { template_version: "plan_completed_v2" },
      { idempotency_key: "plan_completed:other:v1" },
    ]) {
      const bad = completedJob(override);
      expect(resolvePlanCompleted(sendableState(bad), NOW)).toEqual({
        action: "CANCEL",
        reason: "job_not_canonical",
      });
    }
  });

  it("suppresses for unsubscribe, hard bounce, and complaint suppression", () => {
    expect(
      resolvePlanCompleted(
        sendableState(job, { marketingUnsubscribedAt: "2026-02-07T00:00:00.000Z" }),
        NOW,
      ),
    ).toEqual({ action: "SUPPRESS", reason: "marketing_unsubscribed" });
    expect(
      resolvePlanCompleted(
        sendableState(job, { emailSuppressedAt: "2026-02-07T00:00:00.000Z" }),
        NOW,
      ),
    ).toEqual({ action: "SUPPRESS", reason: "recipient_suppressed" });
    expect(resolvePlanCompleted(sendableState(job, { suppressionListed: true }), NOW)).toEqual({
      action: "SUPPRESS",
      reason: "recipient_suppressed",
    });
  });

  it("defers before the persisted eligibility timestamp and until Plan Ready is accepted", () => {
    const early = new Date(new Date(COMPLETED_AT).getTime() - 1);
    expect(resolvePlanCompleted(sendableState(job), early)).toEqual({
      action: "DEFER",
      reason: "eligibility_not_reached",
      eligibleAt: COMPLETED_AT,
    });
    expect(resolvePlanCompleted(sendableState(job, { planReadyAcceptedAt: null }), NOW)).toEqual({
      action: "DEFER",
      reason: "plan_ready_not_accepted",
    });
  });

  it("defers inside the 24-hour lifecycle gap to the exact next eligible timestamp", () => {
    const lastAccepted = "2026-02-08T12:30:00.000Z";
    const nextAllowed = new Date(new Date(lastAccepted).getTime() + LIFECYCLE_MIN_GAP_MS);
    expect(
      resolvePlanCompleted(sendableState(job, { lastLifecycleAcceptedAt: lastAccepted }), NOW),
    ).toEqual({
      action: "DEFER",
      reason: "lifecycle_24h_cap",
      eligibleAt: nextAllowed.toISOString(),
    });
    // Exactly at the horizon the message sends.
    expect(
      resolvePlanCompleted(
        sendableState(job, { lastLifecycleAcceptedAt: lastAccepted }),
        nextAllowed,
      ),
    ).toEqual({ action: "SEND" });
  });

  it("is not blocked by an accepted Final Rescue and has no inactivity cap", () => {
    // Final Rescue acceptance is simply prior lifecycle history: once the shared
    // 24-hour gap has elapsed, Plan Completed still sends.
    const longAgo = "2026-02-05T12:00:00.000Z";
    expect(
      resolvePlanCompleted(sendableState(job, { lastLifecycleAcceptedAt: longAgo }), NOW),
    ).toEqual({ action: "SEND" });
    // The resolver has no inactivity-count input at all.
    expect(Object.keys(sendableState(job))).not.toContain("acceptedInactivityCount");
  });
});

describe("P4 dispatch performs exactly one guarded provider attempt", () => {
  it("accepts a send with the stable idempotency key and click tracking disabled", async () => {
    const { deps, store, adapter, job } = harness();
    const summary = await dispatchPlanCompletedJobs(deps);

    expect(summary.claimed).toBe(1);
    expect(summary.outcomes).toEqual([{ jobId: job.job_id, outcome: "provider_accepted" }]);
    expect(adapter.requests).toHaveLength(1);
    expect(adapter.requests[0]!.idempotencyKey).toBe(planCompletedJobKey("version-1"));
    expect(adapter.requests[0]!.disableClickTracking).toBe(true);
    expect(adapter.requests[0]!.correlationId).toBe(job.job_id);
    expect(eventNames(store)).toContain("email_plan_completed_provider_accepted");
    expect(store.jobs.get(job.job_id)!.status).toBe("provider_accepted");
  });

  it("cannot send twice once Plan Completed was already accepted", async () => {
    const { deps, adapter, store, job } = harness({
      state: { planCompletedAcceptedAt: "2026-02-08T13:00:00.000Z" },
    });
    const summary = await dispatchPlanCompletedJobs(deps);

    expect(adapter.requests).toHaveLength(0);
    expect(summary.outcomes).toEqual([{ jobId: job.job_id, outcome: "canceled" }]);
    expect(eventNames(store)).toEqual(["email_plan_completed_canceled"]);
  });

  it("makes zero provider calls and issues no credentials on DEFER, CANCEL, or SUPPRESS", async () => {
    const cases: Array<[Partial<PlanCompletedState>, string]> = [
      [{ planReadyAcceptedAt: null }, "deferred"],
      [{ planComplete: false }, "canceled"],
      [{ marketingUnsubscribedAt: "2026-02-07T00:00:00.000Z" }, "suppressed"],
    ];

    for (const [state, expected] of cases) {
      const { deps, store, adapter, job } = harness({ state });
      const summary = await dispatchPlanCompletedJobs(deps);

      expect(summary.outcomes[0]!.outcome).toBe(expected);
      expect(adapter.requests).toHaveLength(0);
      expect(store.returnTokens).toHaveLength(0);
      expect(store.preferenceCredentials).toHaveLength(0);
      expect(store.jobs.get(job.job_id)!.first_provider_attempt_at ?? null).toBeNull();
    }
  });

  it("runs first in the dispatch tick, ahead of every lower-priority lifecycle loop", () => {
    const order = [
      "dispatchPlanCompletedJobs(",
      "dispatchHalfwayJobs(",
      "dispatchFinalRescueJobs(",
      "dispatchStalledJobs(",
      "dispatchStartDayOneJobs(",
    ].map((needle) => DISPATCH_ROUTE.lastIndexOf(needle));

    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Plan Ready keeps its existing separate immediate pipeline.
    expect(DISPATCH_ROUTE).toContain("dispatchPlanReadyJobs(runtime.deps");
    expect(PLAN_READY_JOB_TYPE).toBe("plan_ready");
  });
});

describe("P5 locked customer-facing copy", () => {
  const urls = {
    returnUrl: "https://app.genxjumps.com/return?token=abc",
    preferencesUrl: "https://app.genxjumps.com/email-preferences?c=def",
    appOrigin: "https://app.genxjumps.com",
  };

  const personalized = renderPlanCompleted({ action: "SEND" }, { firstName: "Todd", ...urls })!;
  const fallback = renderPlanCompleted({ action: "SEND" }, { firstName: "  ", ...urls })!;

  it("renders nothing for a non-SEND resolution", () => {
    const input = { firstName: "Todd", ...urls };
    expect(renderPlanCompleted({ action: "CANCEL", reason: "plan_incomplete" }, input)).toBeNull();
    expect(
      renderPlanCompleted({ action: "SUPPRESS", reason: "marketing_unsubscribed" }, input),
    ).toBeNull();
    expect(renderPlanCompleted({ action: "DEFER", reason: "lifecycle_24h_cap" }, input)).toBeNull();
  });

  it("uses the exact personalized and fallback subjects and greetings", () => {
    expect(personalized.subject).toBe("Todd, you completed your 7-day plan");
    expect(fallback.subject).toBe("You completed your 7-day plan");
    expect(PLAN_COMPLETED_FALLBACK_SUBJECT).toBe("You completed your 7-day plan");
    expect(personalized.text).toContain("Hey Todd,");
    expect(fallback.text).toContain(PLAN_COMPLETED_GREETING_FALLBACK);
    expect(PLAN_COMPLETED_GREETING_FALLBACK).toBe("Hey there,");
    expect(fallback.personalizedName).toBeNull();
  });

  it("uses the exact preview text, paragraphs, CTA, post-CTA line and sign-off", () => {
    expect(personalized.previewText).toBe("You finished what you started.");
    expect(PLAN_COMPLETED_PREVIEW_TEXT).toBe("You finished what you started.");
    expect(PLAN_COMPLETED_BODY_PARAGRAPHS).toEqual([
      "You did it. You completed every day in your 7-Day Comeback Plan.",
      "That means you worked, recovered, and kept coming back until the plan was done.",
      "Perfect wasn\u2019t required. You finished.",
    ]);
    for (const paragraph of PLAN_COMPLETED_BODY_PARAGRAPHS) {
      expect(personalized.text).toContain(paragraph);
      expect(personalized.html).toContain(paragraph.replace(/'/g, "&#39;"));
    }
    expect(PLAN_COMPLETED_CTA_LABEL).toBe("View My Completed Plan");
    expect(personalized.ctaLabel).toBe("View My Completed Plan");
    expect(personalized.html).toContain("View My Completed Plan");
    expect(PLAN_COMPLETED_POST_CTA_LINE).toBe("Keep moving. Keep rebuilding. Stay capable.");
    expect(personalized.text).toContain(PLAN_COMPLETED_POST_CTA_LINE);
    expect(personalized.html).toContain(PLAN_COMPLETED_POST_CTA_LINE);
    expect(PLAN_COMPLETED_SIGN_OFF).toEqual(["Move or Rust.", "Todd", "Gen X Jumps"]);
    expect(personalized.text).toContain("Move or Rust.\n\nTodd\nGen X Jumps");
  });

  it("reuses the app-owned preferences footer and token-free recovery footer", () => {
    expect(personalized.text).toContain(PLAN_COMPLETED_FOOTER);
    expect(personalized.text).toContain(`Manage email preferences: ${urls.preferencesUrl}`);
    expect(personalized.html).toContain(urls.preferencesUrl);
    expect(personalized.recoveryUrl).toBe(
      `https://app.genxjumps.com${PLAN_COMPLETED_RECOVERY_PATH}`,
    );
    expect(personalized.text).toContain(PLAN_COMPLETED_RECOVERY_LINE);
    expect(personalized.recoveryUrl).not.toContain("?");
  });

  it("never uses the word assignment and carries no promotion or sales copy", () => {
    const combined = [
      personalized.subject,
      personalized.previewText,
      personalized.html,
      personalized.text,
      fallback.subject,
      fallback.html,
      fallback.text,
    ].join("\n");

    expect(combined).not.toMatch(/assignment/i);
    expect(combined).not.toMatch(/accelerator/i);
    expect(combined).not.toMatch(/\$\d/);
    expect(combined).not.toMatch(/\b(price|upsell|discount|offer|buy now|expires in)\b/i);
    expect(combined).not.toMatch(/\bgrams?\b/i);
    expect(combined).not.toMatch(/\bprotein\b/i);
    expect(combined).not.toMatch(/\bW0[1-7]\b/);
  });
});

describe("P6 secure return attribution and destination", () => {
  const token = {
    purpose: "open_plan",
    leadPlanId: "lead-1",
    planVersionId: "version-1",
  };
  const job = {
    jobId: "pc-job",
    jobType: PLAN_COMPLETED_JOB_TYPE,
    jobVersion: PLAN_COMPLETED_JOB_VERSION,
    templateVersion: PLAN_COMPLETED_TEMPLATE_VERSION,
    leadPlanId: "lead-1",
    planVersionId: "version-1",
  };

  it("attributes a deliberate valid exchange to the Plan Completed event", () => {
    expect(resolveLinkExchangeAttribution({ ...token, job })).toEqual({
      eventName: PLAN_COMPLETED_LINK_EXCHANGE_EVENT,
      jobId: "pc-job",
    });
    expect(PLAN_COMPLETED_LINK_EXCHANGE_EVENT).toBe("email_plan_completed_link_exchange_completed");
  });

  it("falls back to the general event for a mismatched or non-open_plan token", () => {
    for (const variant of [
      { ...token, purpose: "email_preferences", job },
      { ...token, job: { ...job, planVersionId: "version-2" } },
      { ...token, job: { ...job, templateVersion: "plan_completed_v2" } },
      { ...token, job: null },
    ]) {
      expect(resolveLinkExchangeAttribution(variant).eventName).toBe(
        PLAN_READY_LINK_EXCHANGE_EVENT,
      );
    }
  });

  it("opens the plan hub, never a specific day page", () => {
    expect(resolveReturnDestination({ ...token, job })).toBe("/your-plan");
    expect(DEFAULT_RETURN_DESTINATION).toBe("/your-plan");
  });

  it("keeps the CTA on the opaque purpose-limited return token only", async () => {
    const { deps, store } = harness();
    await dispatchPlanCompletedJobs(deps);

    expect(store.returnTokens).toHaveLength(1);
    // Only the token hash is ever persisted, scoped to this logical job.
    expect(store.returnTokens[0]!.jobId).toBe("pc-job");
    expect(store.returnTokens[0]!.tokenHash).toBe(
      `hash:cred:open_plan:version-1:${planCompletedJobKey("version-1")}`,
    );
    const request = harnessRequest(store);
    expect(request).not.toMatch(/reader@example\.com/i);
  });
});

/** The rendered CTA link as sent, used to prove no personal data is in the URL. */
function harnessRequest(store: MemoryStore): string {
  return JSON.stringify(store.returnTokens);
}
