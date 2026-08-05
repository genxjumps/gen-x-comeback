// Halfway (halfway_v1) acceptance tests, one block per approved requirement.
//
// Every requirement is proven where the behavior actually lives:
// - atomic boundary requirements assert the committed migration SQL contract
// - resolver/state requirements run the real pure resolver and state loader
// - template requirements run the real renderer
// - dispatch requirements run the real dispatcher against an in-memory store
//   and an injected fake provider
// - exchange requirements run the real exchange and the real /return handlers
//   against an in-memory Supabase boundary
//
// Deterministic: fixed clock, no database, no network, no real sending.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  PLAN_READY_JOB_TYPE,
  PLAN_READY_TEMPLATE_VERSION,
  RETRY_DELAYS_MS,
  START_DAY_1_JOB_TYPE,
  START_DAY_1_TEMPLATE_VERSION,
  type EmailJobRow,
} from "@/lib/email/types";
import { LIFECYCLE_MIN_GAP_MS } from "@/lib/email/start-day-1-resolver";
import {
  halfwayEffectiveFloorMs,
  resolveHalfway,
  type HalfwayState,
} from "@/lib/email/halfway-resolver";
import { deriveEmailCredential } from "@/lib/email/credentials.server";
import { loadHalfwayState, requiredDayNumbers } from "@/lib/email/halfway-state.server";
import {
  HALFWAY_BODY_PARAGRAPHS,
  HALFWAY_CTA_LABEL,
  HALFWAY_FALLBACK_SUBJECT,
  HALFWAY_FOOTER,
  HALFWAY_GREETING_FALLBACK,
  HALFWAY_PREVIEW_TEXT,
  HALFWAY_RECOVERY_LINE,
  renderHalfway,
} from "@/lib/email/halfway-template";
import { lifecycleEventName } from "@/lib/email/event-names";
import {
  DEFAULT_RETURN_DESTINATION,
  resolveReturnDestination,
} from "@/lib/email/return-destination";
import {
  HALFWAY_LINK_EXCHANGE_EVENT,
  PLAN_READY_LINK_EXCHANGE_EVENT,
  resolveLinkExchangeEvent,
  resolveLinkExchangeAttribution,
} from "@/lib/email/link-exchange-event";
import { hashAccessToken } from "@/lib/lead-plan";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";

/* ------------------------------------------------------------------ */
/* Shared fixtures                                                     */
/* ------------------------------------------------------------------ */

const NOW = new Date("2026-02-06T12:00:00.000Z");
const ELIGIBLE_AT = "2026-02-06T11:00:00.000Z";
const PLAN_READY_ACCEPTED_AT = "2026-02-01T12:00:05.000Z";
const APP_ORIGIN = "https://app.genxjumps.com";

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
    totalRequiredAssignments: 7,
    planComplete: false,
    planCompletedControl: false,
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
  lead?: Parameters<typeof makeLead>[0];
  script?: NonNullable<Parameters<typeof createFakeAdapter>[0]>["script"];
  now?: () => Date;
}): Harness {
  const now = options?.now ?? (() => NOW);
  const store = createMemoryStore(now);
  const job = halfwayJob(options?.job ?? {});
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
      loadHalfwayState: async (loaded) => {
        result.loads += 1;
        return eligibleState({ ...job, ...loaded }, options?.state ?? {});
      },
    },
  };
  return result;
}

function eventNames(store: MemoryStore): string[] {
  return store.events.map((e) => String(e.event_name));
}

const RENDER_INPUT = {
  firstName: "Todd",
  returnUrl: `${APP_ORIGIN}/return?token=abc`,
  preferencesUrl: `${APP_ORIGIN}/email-preferences?c=def`,
  appOrigin: APP_ORIGIN,
};

const SEND = { action: "SEND" } as const;

/* ------------------------------------------------------------------ */
/* Committed migration SQL (atomic completion boundary)                */
/* ------------------------------------------------------------------ */

const BASE_MIGRATION = "20260805222359_72fcf5d0-0fe2-4135-b1e2-e7c9d3d93792.sql";
const CORRECTION_MIGRATION = "20260805223427_08dbb52d-6821-4097-bbbb-871f0cea3038.sql";

function migrationSql(file: string): string {
  return readFileSync(join(process.cwd(), "supabase", "migrations", file), "utf8");
}

const SQL = migrationSql(CORRECTION_MIGRATION);
/** Body of the corrected function only, so the base file can never satisfy a check. */
const FN = SQL.slice(SQL.indexOf("CREATE OR REPLACE FUNCTION"));

/* ------------------------------------------------------------------ */
/* R1-R8: server-authoritative atomic completion boundary              */
/* ------------------------------------------------------------------ */

describe("R1 the 3-to-4 required transition creates the canonical Halfway job", () => {
  it("inserts one halfway/v1/halfway_v1 job keyed halfway:{plan_version_id}:v1", () => {
    expect(FN).toContain("INSERT INTO public.email_jobs");
    expect(FN).toContain("'halfway',");
    expect(FN).toContain("'v1',");
    expect(FN).toContain("'halfway_v1',");
    expect(FN).toContain("'halfway:' || p_plan_version_id::text || ':v1'");
    expect(FN).toContain("'pending',");
  });

  it("gates the insert on a newly inserted completion reaching exactly four", () => {
    expect(FN).toContain("IF v_inserted AND v_count = 4 THEN");
  });
});

describe("R2 exactly one queued event and no unapproved Halfway event", () => {
  it("emits email_halfway_queued only when a job row was actually created", () => {
    const eventBlock = FN.slice(FN.indexOf("IF v_job_id IS NOT NULL THEN"));
    expect(eventBlock).toContain("'email_halfway_queued'");
    expect(FN.match(/email_halfway_queued/g)).toHaveLength(1);
  });

  it("never inserts plan_halfway_reached and drops its leftover unique index", () => {
    expect(FN).not.toContain("plan_halfway_reached");
    expect(SQL).toContain("DROP INDEX IF EXISTS public.canonical_events_plan_halfway_reached_key");
    // The unapproved milestone event exists only in the superseded base migration.
    expect(migrationSql(BASE_MIGRATION)).toContain("plan_halfway_reached");
  });
});

describe("R3 no job before the fourth required completion", () => {
  it("counts only completions matching top-level required day numbers", () => {
    expect(FN).toContain("SELECT count(*)::integer INTO v_count");
    expect(FN).toContain("AND c.day_number = ANY(v_required)");
  });

  it("creates nothing for any count other than four", () => {
    expect(FN.match(/v_count = 4/g)).toHaveLength(1);
    expect(FN).not.toMatch(/v_count\s*>=\s*4/);
  });
});

describe("R4 duplicate completion is idempotent and never creates a second job", () => {
  it("inserts the completion with ON CONFLICT DO NOTHING and tracks whether it was new", () => {
    expect(FN).toContain("INSERT INTO public.lead_plan_day_completions (lead_plan_id, day_number)");
    expect(FN).toContain("ON CONFLICT (lead_plan_id, day_number) DO NOTHING");
    expect(FN).toContain("v_inserted := v_completed_at IS NOT NULL;");
  });

  it("relies on the existing unique logical job constraint for a second job attempt", () => {
    expect(FN).toContain("ON CONFLICT (job_type, plan_version_id, job_version) DO NOTHING");
  });
});

describe("R5 nested optional Active Recovery is never a required completion", () => {
  it("derives required day numbers only from top-level plan_json.days", () => {
    expect(FN).toContain("jsonb_array_elements(COALESCE(v_plan->'days', '[]'::jsonb))");
    expect(FN).not.toContain("'optional'");
  });

  it("matches the shared TypeScript derivation used by the state loader", () => {
    const plan = {
      days: [
        { day: 1, code: "W01" },
        { day: 2, title: "Walk or easy movement" },
        { day: 3, code: "W02" },
        { day: 4, title: "Recovery", optional: { code: "W07", day: 99 } },
        { day: 5, code: "W03" },
        { day: 6, title: "Walk or easy movement" },
        { day: 7, title: "Rest" },
      ],
    };
    expect(requiredDayNumbers(plan)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(requiredDayNumbers(plan)).not.toContain(99);
  });
});

describe("R6 a replaced plan version can never gain a Halfway job", () => {
  it("locks and validates the current lead/plan version before any write", () => {
    const preamble = FN.slice(0, FN.indexOf("INSERT INTO public.lead_plan_day_completions"));
    expect(preamble).toContain("FROM public.lead_plans");
    expect(preamble).toContain("AND plan_version_id = p_plan_version_id");
    expect(preamble).toContain("FOR UPDATE");
    expect(preamble).toContain("IF NOT FOUND THEN");
  });

  it("keys the job per plan version so a new version gets its own job", () => {
    expect(FN).toContain("'halfway:' || p_plan_version_id::text || ':v1'");
  });
});

describe("R7 inactivity anchor is the persisted fourth completion timestamp", () => {
  it("captures the actual completed_at of the completion row", () => {
    expect(FN).toContain("RETURNING lead_plan_day_completions.completed_at INTO v_completed_at");
    expect(FN).toContain("SELECT c.completed_at INTO v_completed_at");
  });

  it("stamps job eligible_at/created_at/updated_at and the queued event with it", () => {
    const insert = FN.slice(FN.indexOf("INSERT INTO public.email_jobs"));
    expect(insert.match(/v_completed_at/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("never writes email_last_engaged_at, which is email-link engagement only", () => {
    expect(FN).not.toContain("email_last_engaged_at");
    expect(FN).not.toContain("UPDATE public.lead_plans");
  });
});

describe("R8 only valid top-level required days progress, in order", () => {
  it("rejects a day that is not a top-level required assignment", () => {
    expect(FN).toContain("IF v_required IS NULL OR NOT (p_day_number = ANY(v_required)) THEN");
  });

  it("enforces sequential required progression inside the transaction", () => {
    expect(FN).toContain("FROM unnest(v_required) AS r(day_number)");
    expect(FN).toContain("WHERE r.day_number < p_day_number");
    expect(FN).toContain("NOT EXISTS (");
  });

  it("stays service-role only", () => {
    expect(SQL).toContain("REVOKE ALL ON FUNCTION public.complete_plan_day_atomic");
    expect(SQL).toContain(
      "GRANT EXECUTE ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint)\n  TO service_role;",
    );
  });
});

/* ------------------------------------------------------------------ */
/* R9-R16: authoritative state, validity window, priority, timing      */
/* ------------------------------------------------------------------ */

describe("R9 four required completions is send-eligible", () => {
  it("resolves SEND at the trigger count", () => {
    const job = halfwayJob();
    expect(HALFWAY_MIN_COMPLETIONS).toBe(HALFWAY_TRIGGER_COMPLETIONS);
    expect(resolveHalfway(eligibleState(job), NOW)).toEqual({ action: "SEND" });
  });

  it("cancels below the window", () => {
    const job = halfwayJob();
    const result = resolveHalfway(eligibleState(job, { requiredCompletions: 3 }), NOW);
    expect(result).toMatchObject({
      action: "CANCEL",
      reason: "progress_window_not_reached",
    });
  });
});

describe("R10 five and six required completions stay send-eligible", () => {
  it("resolves SEND at 5 and 6 and cancels at 7", () => {
    const job = halfwayJob();
    for (const count of [5, HALFWAY_MAX_COMPLETIONS]) {
      expect(resolveHalfway(eligibleState(job, { requiredCompletions: count }), NOW)).toEqual({
        action: "SEND",
      });
    }
    expect(
      resolveHalfway(
        eligibleState(job, { requiredCompletions: 7, totalRequiredAssignments: 8 }),
        NOW,
      ),
    ).toMatchObject({ action: "CANCEL", reason: "progress_window_passed" });
  });
});

describe("R11 an authoritatively complete plan cancels", () => {
  it("cancels on planComplete regardless of the raw count", () => {
    const job = halfwayJob();
    const result = resolveHalfway(
      eligibleState(job, {
        requiredCompletions: 7,
        totalRequiredAssignments: 7,
        planComplete: true,
      }),
      NOW,
    );
    expect(result).toMatchObject({
      action: "CANCEL",
      reason: "plan_completed",
    });
  });

  it("cancels even inside the 4-6 window once the plan is complete", () => {
    const job = halfwayJob();
    expect(
      resolveHalfway(
        eligibleState(job, {
          requiredCompletions: 4,
          totalRequiredAssignments: 4,
          planComplete: true,
        }),
        NOW,
      ),
    ).toMatchObject({ reason: "plan_completed" });
  });
});

describe("R12 Plan Completed control always wins with no timestamp tie-breaker", () => {
  it("cancels on control presence alone, whatever the lifecycle timestamps are", () => {
    const job = halfwayJob();
    const base = { planCompletedControl: true };
    const withOldControl = resolveHalfway(
      eligibleState(job, { ...base, lastLifecycleAcceptedAt: "2020-01-01T00:00:00.000Z" }),
      NOW,
    );
    const withNewControl = resolveHalfway(
      eligibleState(job, { ...base, lastLifecycleAcceptedAt: NOW.toISOString() }),
      NOW,
    );
    expect(withOldControl).toEqual(withNewControl);
    expect(withOldControl).toMatchObject({ action: "CANCEL", reason: "plan_completed" });
  });

  it("takes precedence over the deferral reasons below it", () => {
    const job = halfwayJob();
    expect(
      resolveHalfway(
        eligibleState(job, { planCompletedControl: true, planReadyAcceptedAt: null }),
        NOW,
      ),
    ).toMatchObject({ action: "CANCEL", reason: "plan_completed" });
  });
});

describe("R13 replacement, non-canonical jobs, and missing recipients cancel", () => {
  it("cancels a replaced plan version", () => {
    const job = halfwayJob();
    expect(
      resolveHalfway(eligibleState(job, { currentPlanVersionId: "version-2" }), NOW),
    ).toMatchObject({ action: "CANCEL", reason: "plan_version_replaced" });
  });

  it("cancels a non-canonical job type, version, or template", () => {
    for (const patch of [
      { job_type: "halfway_x" },
      { job_version: "v2" },
      { template_version: "halfway_v2" },
    ]) {
      const job = halfwayJob(patch);
      expect(resolveHalfway(eligibleState(job), NOW)).toMatchObject({
        action: "CANCEL",
        reason: "job_not_canonical",
      });
    }
  });

  it("cancels when no deliverable recipient is persisted", () => {
    const job = halfwayJob();
    expect(resolveHalfway(eligibleState(job, { hasRecipient: false }), NOW)).toMatchObject({
      action: "CANCEL",
      reason: "recipient_missing",
    });
  });
});

describe("R14 Halfway priority sits below Plan Completed and above Start Day 1", () => {
  it("dispatches Halfway before Start Day 1 in the worker endpoint", () => {
    const route = readFileSync(
      join(process.cwd(), "src", "routes", "api", "public", "email", "dispatch.ts"),
      "utf8",
    );
    const planReady = route.indexOf("dispatchPlanReadyJobs(runtime.deps");
    const halfway = route.indexOf("dispatchHalfwayJobs(");
    const startDayOne = route.indexOf("dispatchStartDayOneJobs(");
    expect(planReady).toBeGreaterThan(-1);
    expect(halfway).toBeGreaterThan(planReady);
    expect(startDayOne).toBeGreaterThan(halfway);
  });

  it("yields the plan version entirely to Plan Completed when its job exists", () => {
    const job = halfwayJob();
    expect(resolveHalfway(eligibleState(job, { planCompletedControl: true }), NOW)).toMatchObject({
      action: "CANCEL",
      reason: "plan_completed",
    });
  });
});

describe("R15 the 24-hour lifecycle gap defers without any provider attempt", () => {
  it("defers, schedules the exact next-allowed time, and emits no retry event", async () => {
    const lastAccepted = new Date(NOW.getTime() - LIFECYCLE_MIN_GAP_MS / 2).toISOString();
    const h = harness({ state: { lastLifecycleAcceptedAt: lastAccepted } });
    const summary = await dispatchHalfwayJobs(h.deps);

    expect(summary.outcomes).toEqual([{ jobId: h.job.job_id, outcome: "deferred" }]);
    expect(h.adapter.requests).toHaveLength(0);

    const stored = h.store.jobs.get(h.job.job_id)!;
    expect(stored.status).toBe("retry_scheduled");
    expect(stored.next_attempt_at).toBe(
      new Date(new Date(lastAccepted).getTime() + LIFECYCLE_MIN_GAP_MS).toISOString(),
    );
    // A deferral is not a provider attempt: the claim-time increment is restored.
    expect(stored.attempt_count).toBe(0);
    expect(stored.first_provider_attempt_at ?? null).toBeNull();
    expect(eventNames(h.store)).toEqual([]);
  });

  it("defers below the eligibility floor and while Plan Ready is unaccepted", async () => {
    const early = harness({ job: { eligible_at: "2026-02-06T18:00:00.000Z" } });
    expect((await dispatchHalfwayJobs(early.deps)).outcomes[0]?.outcome).toBe("deferred");
    expect(early.adapter.requests).toHaveLength(0);

    const unaccepted = harness({ state: { planReadyAcceptedAt: null } });
    expect((await dispatchHalfwayJobs(unaccepted.deps)).outcomes[0]?.outcome).toBe("deferred");
    expect(unaccepted.adapter.requests).toHaveLength(0);
  });
});

describe("R16 authoritative state counts only top-level required assignments", () => {
  type Row = Record<string, unknown>;

  function client(rowsByTable: Record<string, Row[]>) {
    const seen: Array<{ table: string; filters: Row }> = [];
    return {
      seen,
      from(table: string) {
        return {
          select() {
            const filters: Row = {};
            const builder = {
              eq(column: string, value: unknown) {
                filters[column] = value;
                return builder;
              },
              in() {
                return builder;
              },
              order() {
                return builder;
              },
              limit() {
                seen.push({ table, filters: { ...filters } });
                const rows = (rowsByTable[table] ?? []).filter((row) =>
                  Object.entries(filters).every(([k, v]) => row[k] === v),
                );
                return Promise.resolve({ data: rows, error: null });
              },
            };
            return builder;
          },
        };
      },
    };
  }

  const job = {
    job_id: "halfway-job",
    job_type: HALFWAY_JOB_TYPE,
    job_version: HALFWAY_JOB_VERSION,
    template_version: HALFWAY_TEMPLATE_VERSION,
    lead_plan_id: "lead-1",
    plan_version_id: "version-1",
    eligible_at: ELIGIBLE_AT,
  };

  const planJson = {
    days: [
      { day: 1, code: "W01" },
      { day: 2, title: "Walk or easy movement" },
      { day: 3, code: "W02" },
      { day: 4, title: "Recovery", optional: { code: "W07", day: 42 } },
    ],
  };

  function tables(extra?: Record<string, Row[]>): Record<string, Row[]> {
    return {
      lead_plans: [
        {
          id: "lead-1",
          plan_version_id: "version-1",
          plan_json: planJson,
          email_original: "Reader@Example.com",
          email_normalized: "reader@example.com",
          marketing_unsubscribed_at: null,
          email_suppressed_at: null,
        },
      ],
      lead_plan_day_completions: [
        { lead_plan_id: "lead-1", day_number: 1 },
        { lead_plan_id: "lead-1", day_number: 2 },
        { lead_plan_id: "lead-1", day_number: 3 },
        // A stray completion outside the top-level assignments must not count.
        { lead_plan_id: "lead-1", day_number: 42 },
      ],
      email_jobs: [],
      email_suppressions: [],
      ...extra,
    };
  }

  it("ignores completions that are not top-level required assignments", async () => {
    const state = await loadHalfwayState(job, client(tables()) as never);
    expect(state.requiredCompletions).toBe(3);
    expect(state.totalRequiredAssignments).toBe(4);
    expect(state.planComplete).toBe(false);
  });

  it("exposes an authoritative plan-complete flag", async () => {
    const rows = tables();
    rows["lead_plan_day_completions"] = [
      { lead_plan_id: "lead-1", day_number: 1 },
      { lead_plan_id: "lead-1", day_number: 2 },
      { lead_plan_id: "lead-1", day_number: 3 },
      { lead_plan_id: "lead-1", day_number: 4 },
    ];
    const state = await loadHalfwayState(job, client(rows) as never);
    expect(state.requiredCompletions).toBe(4);
    expect(state.planComplete).toBe(true);
  });

  it("reports Plan Completed control from persisted state for this plan version", async () => {
    const rows = tables({
      email_jobs: [
        {
          job_id: "pc-1",
          job_type: "plan_completed",
          plan_version_id: "version-1",
          status: "pending",
        },
      ],
    });
    const state = await loadHalfwayState(job, client(rows) as never);
    expect(state.planCompletedControl).toBe(true);
  });

  it("rejects an unusable persisted recipient address", async () => {
    const rows = tables();
    rows["lead_plans"] = [{ ...rows["lead_plans"]![0]!, email_original: "not-an-address" }];
    const state = await loadHalfwayState(job, client(rows) as never);
    expect(state.hasRecipient).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* R17-R23: locked approved content                                    */
/* ------------------------------------------------------------------ */

const rendered = renderHalfway(SEND, RENDER_INPUT)!;
const fallbackRendered = renderHalfway(SEND, { ...RENDER_INPUT, firstName: "   " })!;

describe("R17 approved subject line and fallback", () => {
  it("uses the personalized subject", () => {
    expect(rendered.subject).toBe("Todd, you're building real momentum");
  });

  it("uses the approved fallback subject when there is no usable name", () => {
    expect(fallbackRendered.subject).toBe("You're building real momentum");
    expect(HALFWAY_FALLBACK_SUBJECT).toBe("You're building real momentum");
  });
});

describe("R18 approved hidden preview text", () => {
  it("is exactly the approved line and is hidden in HTML", () => {
    expect(rendered.previewText).toBe("Keep going. Your comeback is already taking shape.");
    expect(HALFWAY_PREVIEW_TEXT).toBe(rendered.previewText);
    expect(rendered.html).toContain(
      `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${rendered.previewText}</div>`,
    );
  });
});

describe("R19 approved greeting and fallback", () => {
  it("greets by sanitized name", () => {
    expect(rendered.text.startsWith("Hey Todd,")).toBe(true);
    expect(rendered.html).toContain('<p style="margin:0 0 16px 0;">Hey Todd,</p>');
  });

  it("falls back to the approved greeting", () => {
    expect(fallbackRendered.personalizedName).toBeNull();
    expect(fallbackRendered.text.startsWith(HALFWAY_GREETING_FALLBACK)).toBe(true);
    expect(HALFWAY_GREETING_FALLBACK).toBe("Hey there,");
  });
});

describe("R20 approved body paragraphs, in order, with no old copy", () => {
  it("renders the four approved paragraphs in order", () => {
    expect([...HALFWAY_BODY_PARAGRAPHS]).toEqual([
      "You've already completed several workouts.",
      "That's more than most people ever do.",
      "You're building strength, improving your conditioning, and proving you can stay consistent.",
      "Keep showing up. The finish line is getting closer.",
    ]);
    const positions = HALFWAY_BODY_PARAGRAPHS.map((p) => rendered.text.indexOf(p));
    expect(positions.every((i) => i > 0)).toBe(true);
    expect([...positions]).toEqual([...positions].sort((a, b) => a - b));
  });

  it("contains no removed day-count copy and no promotional copy", () => {
    for (const forbidden of [
      "halfway there",
      "Three days left",
      "four days into",
      "Keep the momentum",
      "discount",
      "offer",
      "buy",
    ]) {
      expect(rendered.text.toLowerCase()).not.toContain(forbidden.toLowerCase());
      expect(rendered.html.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("R21 approved CTA and close", () => {
  it("uses the Continue My Plan CTA pointing at the secure return URL", () => {
    expect(rendered.ctaLabel).toBe("Continue My Plan");
    expect(HALFWAY_CTA_LABEL).toBe("Continue My Plan");
    expect(rendered.html).toContain(`>${HALFWAY_CTA_LABEL}</a>`);
    expect(rendered.html).toContain(`href="${RENDER_INPUT.returnUrl}"`);
    expect(rendered.text).toContain(`Continue My Plan: ${RENDER_INPUT.returnUrl}`);
  });

  it("closes with the approved signature", () => {
    expect(rendered.text).toContain("Move or Rust.\n\nTodd\nGen X Jumps");
    expect(rendered.html).toContain("Todd<br />Gen X Jumps");
  });
});

describe("R22 secondary recovery line before the footer", () => {
  it("uses the exact approved sentence", () => {
    expect(HALFWAY_RECOVERY_LINE).toBe(
      "Lost access to your plan? Recover it here and pick up where you left off.",
    );
  });

  it("links only 'Recover it here' to the token-free absolute /recover URL, not a button", () => {
    expect(rendered.recoveryUrl).toBe(`${APP_ORIGIN}/recover`);
    expect(rendered.html).toContain(
      `Lost access to your plan? <a href="${APP_ORIGIN}/recover" style="color:#666666;">Recover it here</a> and pick up where you left off.`,
    );
    // Not a button: no CTA-style inline-block background treatment on that link.
    expect(rendered.html).not.toContain(
      `<a href="${APP_ORIGIN}/recover" style="display:inline-block`,
    );
    // Token free.
    expect(rendered.recoveryUrl).not.toContain("?");
    expect(rendered.recoveryUrl).not.toContain("token");
  });

  it("includes the same line plus the absolute URL in plain text, before the footer", () => {
    expect(rendered.text).toContain(`${HALFWAY_RECOVERY_LINE} ${APP_ORIGIN}/recover`);
    expect(rendered.text.indexOf(HALFWAY_RECOVERY_LINE)).toBeLessThan(
      rendered.text.indexOf(HALFWAY_FOOTER),
    );
    expect(rendered.html.indexOf("Recover it here")).toBeLessThan(
      rendered.html.indexOf(HALFWAY_FOOTER),
    );
  });
});

describe("R23 deterministic, non-mutating, imageless render with the shared footer", () => {
  it("is byte-identical across renders and never mutates its input", () => {
    const input = { ...RENDER_INPUT };
    const a = renderHalfway(SEND, input)!;
    const b = renderHalfway(SEND, input)!;
    expect(a).toEqual(b);
    expect(input).toEqual(RENDER_INPUT);
  });

  it("carries the shared footer and preferences link and no images", () => {
    expect(rendered.text).toContain(HALFWAY_FOOTER);
    expect(rendered.html).toContain(HALFWAY_FOOTER);
    expect(rendered.html).toContain(`href="${RENDER_INPUT.preferencesUrl}"`);
    expect(rendered.html).not.toContain("<img");
  });

  it("never renders a canceled resolution", () => {
    expect(renderHalfway({ action: "CANCEL", reason: "plan_completed" }, RENDER_INPUT)).toBeNull();
    expect(
      renderHalfway({ action: "DEFER", reason: "lifecycle_24h_cap" }, RENDER_INPUT),
    ).toBeNull();
    expect(
      renderHalfway({ action: "SUPPRESS", reason: "recipient_suppressed" }, RENDER_INPUT),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* R24-R25: dispatch behavior                                          */
/* ------------------------------------------------------------------ */

describe("R24 suppression, credentials, payload, acceptance, and delivery", () => {
  it("suppresses an unsubscribed or suppressed recipient with no provider attempt", async () => {
    for (const state of [
      { marketingUnsubscribedAt: NOW.toISOString() },
      { emailSuppressedAt: NOW.toISOString() },
      { suppressionListed: true },
    ]) {
      const h = harness({ state });
      const summary = await dispatchHalfwayJobs(h.deps);
      expect(summary.outcomes[0]?.outcome).toBe("suppressed");
      expect(h.adapter.requests).toHaveLength(0);
      expect(h.store.jobs.get(h.job.job_id)!.status).toBe("suppressed");
      expect(eventNames(h.store)).toEqual([lifecycleEventName(HALFWAY_JOB_TYPE, "suppressed")]);
    }
  });

  it("stores only the hash of a return token that is associated with this job", async () => {
    const h = harness();
    await dispatchHalfwayJobs(h.deps);
    expect(h.store.returnTokens).toHaveLength(1);
    const token = h.store.returnTokens[0]!;
    expect(token.jobId).toBe(h.job.job_id);
    expect(token.tokenHash).toBe("hash:cred:open_plan:version-1");
    expect(token.tokenHash).not.toBe("cred:open_plan:version-1");
    expect(Object.keys(token)).not.toContain("token");
  });

  it("sends the minimum approved payload with click tracking disabled", async () => {
    const h = harness();
    await dispatchHalfwayJobs(h.deps);
    const request = h.adapter.requests[0]!;
    expect(request.to).toBe("Reader@Example.com");
    expect(request.idempotencyKey).toBe(`halfway:version-1:${HALFWAY_JOB_VERSION}`);
    expect(request.correlationId).toBe(h.job.job_id);
    expect(request.disableClickTracking).toBe(true);
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
    const payload = JSON.stringify(request);
    for (const leak of ["protein", "assessment", "reader@example.com"]) {
      expect(payload).not.toContain(leak);
    }
  });

  it("separates provider acceptance from delivery", async () => {
    const h = harness();
    await dispatchHalfwayJobs(h.deps);
    const stored = h.store.jobs.get(h.job.job_id)!;
    expect(stored.status).toBe("provider_accepted");
    expect(stored.delivery_status).toBe("pending");
    expect(eventNames(h.store)).toEqual(["email_halfway_provider_accepted"]);

    await h.store.applyDeliveryEvent(h.job.job_id, "delivered", NOW.toISOString());
    expect(h.store.jobs.get(h.job.job_id)!.delivery_status).toBe("delivered");
    expect(eventNames(h.store)).toContain("email_halfway_delivered");
  });
});

describe("R25 retry, permanent failure, no resend, and lease recovery", () => {
  it("schedules the contract retry delay on a transient failure", async () => {
    const h = harness({ script: [{ outcome: "transient", errorCode: "timeout" }] });
    const summary = await dispatchHalfwayJobs(h.deps);
    expect(summary.outcomes[0]).toMatchObject({ outcome: "retry_scheduled", errorCode: "timeout" });
    const stored = h.store.jobs.get(h.job.job_id)!;
    expect(stored.next_attempt_at).toBe(
      new Date(NOW.getTime() + RETRY_DELAYS_MS[0]!).toISOString(),
    );
    expect(eventNames(h.store)).toEqual(["email_halfway_retry_scheduled"]);
  });

  it("fails permanently on a permanent provider error and raises an alert", async () => {
    const h = harness({ script: [{ outcome: "permanent", errorCode: "invalid_recipient" }] });
    await dispatchHalfwayJobs(h.deps);
    expect(h.store.jobs.get(h.job.job_id)!.status).toBe("failed_permanent");
    expect(eventNames(h.store)).toEqual(["email_halfway_failed_permanent"]);
    expect(h.store.alerts[0]?.alert_type).toBe("halfway_failed_permanent");
  });

  it("never sends twice: an accepted job is not claimed again", async () => {
    const h = harness();
    await dispatchHalfwayJobs(h.deps);
    const second = await dispatchHalfwayJobs(h.deps);
    expect(second.claimed).toBe(0);
    expect(h.adapter.requests).toHaveLength(1);
  });

  it("gives up after the maximum attempts", async () => {
    const h = harness({
      job: { attempt_count: MAX_ATTEMPTS - 1 },
      script: [{ outcome: "transient", errorCode: "timeout" }],
    });
    await dispatchHalfwayJobs(h.deps);
    expect(h.store.jobs.get(h.job.job_id)!.status).toBe("failed_permanent");
  });

  it("writes nothing when the lease was stolen by another worker", async () => {
    const h = harness();
    const store = h.store;
    const original = store.claimJobs.bind(store);
    store.claimJobs = async (...args: Parameters<typeof original>) => {
      const claimed = await original(...args);
      store.stealLease(h.job.job_id);
      return claimed;
    };
    const summary = await dispatchHalfwayJobs(h.deps);
    expect(summary.outcomes[0]?.outcome).toBe("lost_lease");
    expect(eventNames(store)).toEqual([]);
    expect(store.jobs.get(h.job.job_id)!.status).toBe("processing");
  });

  it("re-resolves state at dispatch time so late progress still cancels", async () => {
    const h = harness({ state: { requiredCompletions: 7, totalRequiredAssignments: 8 } });
    await dispatchHalfwayJobs(h.deps);
    expect(h.loads).toBe(1);
    expect(h.adapter.requests).toHaveLength(0);
    expect(h.store.jobs.get(h.job.job_id)!.status).toBe("canceled");
  });
});

/* ------------------------------------------------------------------ */
/* R26: secure return exchange                                         */
/* ------------------------------------------------------------------ */

type ExRow = Record<string, unknown>;
type Write = { table: string; op: "insert" | "update"; payload: unknown };

const LEAD = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "44444444-4444-4444-8444-444444444444";
const TOKEN_ID = "55555555-5555-4555-8555-555555555555";
const RAW = "H".repeat(43);

const ex: { rows: Record<string, ExRow[]>; writes: Write[] } = { rows: {}, writes: [] };

vi.mock("@/lib/email/rate-limit.server", () => ({
  callerBucketKey: () => "halfway-test-bucket",
  consumeRateLimit: async () => ({ allowed: true }),
}));

vi.mock("@/integrations/supabase/client.server", () => {
  const from = (table: string) => ({
    select: () => {
      const filters: ExRow = {};
      const query = {
        eq(column: string, value: unknown) {
          filters[column] = value;
          return query;
        },
        limit() {
          const rows = (ex.rows[table] ?? []).filter((row) =>
            Object.entries(filters).every(([k, v]) => row[k] === v),
          );
          return Promise.resolve({ data: rows, error: null });
        },
      };
      return query;
    },
    insert: (payload: unknown) => {
      ex.writes.push({ table, op: "insert", payload });
      return Promise.resolve({ error: null });
    },
    update: (payload: unknown) => ({
      eq: () => {
        ex.writes.push({ table, op: "update", payload });
        return Promise.resolve({ error: null });
      },
    }),
  });
  return { supabaseAdmin: { from } };
});

async function seedExchange(job: ExRow | null, purpose = "open_plan") {
  ex.rows = {
    plan_return_tokens: [
      {
        token_id: TOKEN_ID,
        lead_plan_id: LEAD,
        plan_version_id: VERSION,
        purpose,
        token_hash: await hashAccessToken(RAW),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        revoked_at: null,
        use_count: 0,
        job_id: job === null ? null : JOB_ID,
      },
    ],
    lead_plans: [{ id: LEAD, plan_version_id: VERSION, email_verified_at: null }],
    email_jobs: job === null ? [] : [{ job_id: JOB_ID, ...job }],
  };
  ex.writes = [];
}

const HALFWAY_JOB_ROW: ExRow = {
  job_type: HALFWAY_JOB_TYPE,
  job_version: HALFWAY_JOB_VERSION,
  template_version: HALFWAY_TEMPLATE_VERSION,
  lead_plan_id: LEAD,
  plan_version_id: VERSION,
};

async function exchange(raw: string | null) {
  const { exchangeReturnToken } = await import("@/lib/email/return-exchange.server");
  return exchangeReturnToken(raw);
}

async function returnHandler(method: "GET" | "POST") {
  const mod = await import("@/routes/return");
  const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
  const server = options["server"] as {
    handlers: Record<string, (ctx: { request: Request }) => Promise<Response>>;
  };
  return server.handlers[method]!;
}

function exchangeEvents(): string[] {
  return ex.writes
    .filter((w) => w.table === "canonical_events" && w.op === "insert")
    .flatMap((w) => (w.payload as ExRow[]).map((row) => String(row["event_name"])));
}

describe("R26 Halfway return exchange is trusted, closed, and read-only", () => {
  beforeEach(async () => {
    await seedExchange(HALFWAY_JOB_ROW);
  });

  it("redirects a valid Halfway exchange to /your-plan, never a specific day", async () => {
    const result = await exchange(RAW);
    expect(result).toMatchObject({ ok: true, destination: DEFAULT_RETURN_DESTINATION });
    expect(
      resolveReturnDestination({
        purpose: "open_plan",
        leadPlanId: LEAD,
        planVersionId: VERSION,
        job: {
          jobType: HALFWAY_JOB_TYPE,
          templateVersion: HALFWAY_TEMPLATE_VERSION,
          leadPlanId: LEAD,
          planVersionId: VERSION,
        },
      }),
    ).toBe("/your-plan");
  });

  it("emits the Halfway link-exchange event for a matching, owned Halfway job", async () => {
    await exchange(RAW);
    expect(exchangeEvents()).toContain(HALFWAY_LINK_EXCHANGE_EVENT);
    expect(exchangeEvents()).not.toContain(PLAN_READY_LINK_EXCHANGE_EVENT);
  });

  it("never emits it for job-less, Plan Ready, Start Day 1, mismatched, or recovery tokens", () => {
    const base = { purpose: "open_plan", leadPlanId: LEAD, planVersionId: VERSION };
    const cases = [
      { ...base, job: null },
      {
        ...base,
        job: {
          jobType: PLAN_READY_JOB_TYPE,
          templateVersion: PLAN_READY_TEMPLATE_VERSION,
          leadPlanId: LEAD,
          planVersionId: VERSION,
        },
      },
      {
        ...base,
        job: {
          jobType: START_DAY_1_JOB_TYPE,
          templateVersion: START_DAY_1_TEMPLATE_VERSION,
          leadPlanId: LEAD,
          planVersionId: VERSION,
        },
      },
      {
        ...base,
        job: {
          jobType: HALFWAY_JOB_TYPE,
          templateVersion: "halfway_v2",
          leadPlanId: LEAD,
          planVersionId: VERSION,
        },
      },
      {
        ...base,
        job: {
          jobType: HALFWAY_JOB_TYPE,
          templateVersion: HALFWAY_TEMPLATE_VERSION,
          leadPlanId: "other-lead",
          planVersionId: VERSION,
        },
      },
      {
        ...base,
        job: {
          jobType: HALFWAY_JOB_TYPE,
          templateVersion: HALFWAY_TEMPLATE_VERSION,
          leadPlanId: LEAD,
          planVersionId: "other-version",
        },
      },
      {
        purpose: "recovery",
        leadPlanId: LEAD,
        planVersionId: VERSION,
        job: {
          jobType: HALFWAY_JOB_TYPE,
          templateVersion: HALFWAY_TEMPLATE_VERSION,
          leadPlanId: LEAD,
          planVersionId: VERSION,
        },
      },
    ];
    for (const input of cases) {
      expect(resolveLinkExchangeEvent(input)).toBe(PLAN_READY_LINK_EXCHANGE_EVENT);
    }
  });

  it("emits no Halfway event for invalid, expired, revoked, malformed, or replaced tokens", async () => {
    for (const raw of [null, "short", `${RAW}!`, "B".repeat(43)]) {
      await seedExchange(HALFWAY_JOB_ROW);
      expect(await exchange(raw)).toEqual({ ok: false });
      expect(exchangeEvents()).toEqual([]);
      expect(ex.writes).toHaveLength(0);
    }

    await seedExchange(HALFWAY_JOB_ROW);
    ex.rows["plan_return_tokens"]![0]!["revoked_at"] = new Date().toISOString();
    expect(await exchange(RAW)).toEqual({ ok: false });

    await seedExchange(HALFWAY_JOB_ROW);
    ex.rows["plan_return_tokens"]![0]!["expires_at"] = new Date(Date.now() - 1000).toISOString();
    expect(await exchange(RAW)).toEqual({ ok: false });

    await seedExchange(HALFWAY_JOB_ROW);
    ex.rows["lead_plans"]![0]!["plan_version_id"] = "replaced-version";
    expect(await exchange(RAW)).toEqual({ ok: false });
    expect(ex.writes).toHaveLength(0);
  });

  it("removes the token from the URL with a 303 to the trusted destination", async () => {
    const handler = await returnHandler("POST");
    const body = new URLSearchParams({ token: RAW });
    const res = await handler({
      request: new Request(`${APP_ORIGIN}/return`, { method: "POST", body }),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/your-plan");
    expect(res.headers.get("location")).not.toContain(RAW);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns one generic page for an unusable token", async () => {
    const handler = await returnHandler("POST");
    const res = await handler({
      request: new Request(`${APP_ORIGIN}/return`, {
        method: "POST",
        body: new URLSearchParams({ token: "B".repeat(43) }),
      }),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("This Link No Longer Works");
    expect(html).not.toContain("halfway");
  });

  it("keeps a raw GET read-only and never mutates plan progress", async () => {
    const handler = await returnHandler("GET");
    const res = await handler({
      request: new Request(`${APP_ORIGIN}/return?token=${RAW}`),
    });
    expect(res.status).toBe(200);
    expect(ex.writes).toHaveLength(0);

    await seedExchange(HALFWAY_JOB_ROW);
    await exchange(RAW);
    expect(ex.writes.map((w) => w.table)).not.toContain("lead_plan_day_completions");
    expect(ex.writes.map((w) => w.table)).not.toContain("email_jobs");
    expect(JSON.stringify(ex.writes)).not.toContain("day_number");
  });
});

/* ------------------------------------------------------------------ */
/* Final contract correction: four explicit resolver actions           */
/* ------------------------------------------------------------------ */

describe("Halfway resolves exactly four explicit dispatch actions", () => {
  it("returns SEND with no reason", () => {
    expect(resolveHalfway(eligibleState(halfwayJob()), NOW)).toEqual({ action: "SEND" });
  });

  it("returns DEFER with an approved deferral reason and no disposition field", () => {
    const job = halfwayJob();
    expect(resolveHalfway(eligibleState(job, { planReadyAcceptedAt: null }), NOW)).toEqual({
      action: "DEFER",
      reason: "plan_ready_not_accepted",
    });

    const early = halfwayJob({ eligible_at: "2026-02-06T18:00:00.000Z" });
    expect(resolveHalfway(eligibleState(early), NOW)).toEqual({
      action: "DEFER",
      reason: "eligibility_floor_not_reached",
      eligibleAt: "2026-02-06T18:00:00.000Z",
    });

    const lastAccepted = new Date(NOW.getTime() - LIFECYCLE_MIN_GAP_MS / 2).toISOString();
    expect(
      resolveHalfway(eligibleState(job, { lastLifecycleAcceptedAt: lastAccepted }), NOW),
    ).toEqual({
      action: "DEFER",
      reason: "lifecycle_24h_cap",
      eligibleAt: new Date(new Date(lastAccepted).getTime() + LIFECYCLE_MIN_GAP_MS).toISOString(),
    });
  });

  it("returns SUPPRESS for unsubscribe and suppression, never CANCEL", () => {
    const job = halfwayJob();
    expect(
      resolveHalfway(eligibleState(job, { marketingUnsubscribedAt: NOW.toISOString() }), NOW),
    ).toEqual({ action: "SUPPRESS", reason: "marketing_unsubscribed" });
    expect(
      resolveHalfway(eligibleState(job, { emailSuppressedAt: NOW.toISOString() }), NOW),
    ).toEqual({ action: "SUPPRESS", reason: "recipient_suppressed" });
    expect(resolveHalfway(eligibleState(job, { suppressionListed: true }), NOW)).toEqual({
      action: "SUPPRESS",
      reason: "recipient_suppressed",
    });
  });

  it("returns CANCEL with an approved cancellation reason", () => {
    expect(resolveHalfway(eligibleState(halfwayJob({ job_version: "v9" })), NOW)).toEqual({
      action: "CANCEL",
      reason: "job_not_canonical",
    });
  });

  it("maps each action to its dispatch outcome", async () => {
    const send = harness();
    expect((await dispatchHalfwayJobs(send.deps)).outcomes[0]?.outcome).toBe("provider_accepted");

    const deferred = harness({ state: { planReadyAcceptedAt: null } });
    expect((await dispatchHalfwayJobs(deferred.deps)).outcomes[0]?.outcome).toBe("deferred");
    expect(deferred.adapter.requests).toHaveLength(0);

    const suppressed = harness({ state: { suppressionListed: true } });
    expect((await dispatchHalfwayJobs(suppressed.deps)).outcomes[0]?.outcome).toBe("suppressed");
    expect(suppressed.adapter.requests).toHaveLength(0);

    const canceled = harness({ state: { currentPlanVersionId: "version-2" } });
    expect((await dispatchHalfwayJobs(canceled.deps)).outcomes[0]?.outcome).toBe("canceled");
    expect(canceled.adapter.requests).toHaveLength(0);
    expect(canceled.store.returnTokens).toHaveLength(0);
  });
});

describe("Halfway contract corrections", () => {
  it("restores the pre-claim attempt count on every deferral", async () => {
    const h = harness({ state: { planReadyAcceptedAt: null } });
    await dispatchHalfwayJobs(h.deps);
    const stored = h.store.jobs.get(h.job.job_id)!;
    expect(stored.status).toBe("retry_scheduled");
    expect(stored.attempt_count).toBe(0);
    expect(eventNames(h.store)).toEqual([]);
    expect(h.adapter.requests).toHaveLength(0);
  });

  it("applies the full 24-hour Plan Ready ordering gap to the eligibility floor", () => {
    const accepted = "2026-02-07T00:00:00.000Z";
    const floor = halfwayEffectiveFloorMs("2026-02-07T06:00:00.000Z", accepted);
    expect(new Date(floor).toISOString()).toBe("2026-02-08T00:00:00.000Z");
    expect(halfwayEffectiveFloorMs("2026-02-10T00:00:00.000Z", accepted)).toBe(
      new Date("2026-02-10T00:00:00.000Z").getTime(),
    );
  });

  it("derives a distinct open_plan credential per logical job for one plan version", () => {
    const halfway = deriveEmailCredential("s", "open_plan", VERSION, `halfway:${VERSION}:v1`);
    const planReady = deriveEmailCredential("s", "open_plan", VERSION, `plan_ready:${VERSION}:v1`);
    expect(halfway).not.toBe(planReady);
    // Retrying the same logical job reproduces the identical credential.
    expect(deriveEmailCredential("s", "open_plan", VERSION, `halfway:${VERSION}:v1`)).toBe(halfway);
  });

  it("rejects a non-canonical job version for Halfway attribution", () => {
    const base = {
      purpose: "open_plan",
      leadPlanId: LEAD,
      planVersionId: VERSION,
      job: {
        jobId: JOB_ID,
        jobType: HALFWAY_JOB_TYPE,
        templateVersion: HALFWAY_TEMPLATE_VERSION,
        leadPlanId: LEAD,
        planVersionId: VERSION,
      },
    };
    expect(
      resolveLinkExchangeAttribution({ ...base, job: { ...base.job, jobVersion: "v2" } }),
    ).toEqual({ eventName: PLAN_READY_LINK_EXCHANGE_EVENT, jobId: null });
    expect(
      resolveLinkExchangeAttribution({
        ...base,
        job: { ...base.job, jobVersion: HALFWAY_JOB_VERSION },
      }),
    ).toEqual({ eventName: HALFWAY_LINK_EXCHANGE_EVENT, jobId: JOB_ID });
  });

  it("attributes the exchange event to its originating job id", async () => {
    await seedExchange(HALFWAY_JOB_ROW);
    await exchange(RAW);
    const rows = ex.writes
      .filter((w) => w.table === "canonical_events" && w.op === "insert")
      .flatMap((w) => w.payload as ExRow[])
      .filter((row) => row["event_name"] === HALFWAY_LINK_EXCHANGE_EVENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!["job_id"]).toBe(JOB_ID);
  });
});

describe("Plan Completed is checked before every other Halfway gate", () => {
  it("cancels for plan_completed even with a missing recipient", () => {
    expect(
      resolveHalfway(
        eligibleState(halfwayJob(), { planCompletedControl: true, hasRecipient: false }),
        NOW,
      ),
    ).toEqual({ action: "CANCEL", reason: "plan_completed" });
  });

  it("cancels for plan_completed even with suppression present", () => {
    expect(
      resolveHalfway(
        eligibleState(halfwayJob(), {
          planComplete: true,
          suppressionListed: true,
          marketingUnsubscribedAt: NOW.toISOString(),
        }),
        NOW,
      ),
    ).toEqual({ action: "CANCEL", reason: "plan_completed" });
  });

  it("cancels for plan_completed even when a deferral condition also applies", () => {
    const lastAccepted = new Date(NOW.getTime() - 1000).toISOString();
    expect(
      resolveHalfway(
        eligibleState(halfwayJob(), {
          planCompletedControl: true,
          planReadyAcceptedAt: null,
          lastLifecycleAcceptedAt: lastAccepted,
          hasRecipient: false,
          suppressionListed: true,
          requiredCompletions: 2,
        }),
        NOW,
      ),
    ).toEqual({ action: "CANCEL", reason: "plan_completed" });
  });

  it("still cancels through the dispatcher with no provider attempt", async () => {
    const h = harness({ state: { planCompletedControl: true, suppressionListed: true } });
    expect((await dispatchHalfwayJobs(h.deps)).outcomes[0]?.outcome).toBe("canceled");
    expect(h.adapter.requests).toHaveLength(0);
  });
});
