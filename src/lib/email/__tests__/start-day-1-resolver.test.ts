import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_MIN_GAP_MS,
  MAX_ACCEPTED_INACTIVITY_EMAILS,
  resolveStartDayOne,
  type StartDayOneState,
} from "@/lib/email/start-day-1-resolver";
import { loadStartDayOneState } from "@/lib/email/start-day-1-state.server";
import {
  START_DAY_1_JOB_TYPE,
  START_DAY_1_JOB_VERSION,
  START_DAY_1_TEMPLATE_VERSION,
} from "@/lib/email/types";

const LEAD = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const CREATED = Date.parse("2026-08-01T00:00:00.000Z");
const FLOOR_ISO = new Date(CREATED + 24 * 60 * 60 * 1000).toISOString();

const job = {
  job_id: "33333333-3333-4333-8333-333333333333",
  job_type: START_DAY_1_JOB_TYPE,
  job_version: START_DAY_1_JOB_VERSION,
  template_version: START_DAY_1_TEMPLATE_VERSION,
  lead_plan_id: LEAD,
  plan_version_id: VERSION,
  eligible_at: FLOOR_ISO,
};

function state(overrides: Partial<StartDayOneState> = {}): StartDayOneState {
  return {
    job,
    currentPlanVersionId: VERSION,
    hasRecipient: true,
    marketingUnsubscribedAt: null,
    emailSuppressedAt: null,
    suppressionListed: false,
    dayOneStartedAt: null,
    dayOneCompletedAt: null,
    planReadyAcceptedAt: new Date(CREATED + 60_000).toISOString(),
    lastLifecycleAcceptedAt: null,
    acceptedInactivityCount: 0,
    ...overrides,
  };
}

const AFTER_FLOOR = new Date(Date.parse(FLOOR_ISO) + 60_000);

describe("Start Day 1 dispatch-time resolver", () => {
  it("returns START when Day 1 is unstarted and incomplete", () => {
    expect(resolveStartDayOne(state(), AFTER_FLOOR)).toEqual({ action: "START" });
  });

  it("returns RESUME when Day 1 was deliberately started and is incomplete", () => {
    expect(
      resolveStartDayOne(state({ dayOneStartedAt: FLOOR_ISO }), AFTER_FLOOR),
    ).toEqual({ action: "RESUME" });
  });

  it("cancels when Day 1 is complete", () => {
    expect(
      resolveStartDayOne(
        state({ dayOneCompletedAt: FLOOR_ISO, dayOneStartedAt: FLOOR_ISO }),
        AFTER_FLOOR,
      ),
    ).toEqual({ action: "CANCEL", reason: "day_1_complete", disposition: "cancel" });
  });

  it("cancels when the plan version was replaced", () => {
    expect(
      resolveStartDayOne(state({ currentPlanVersionId: "44444444-4444-4444-8444-444444444444" }), AFTER_FLOOR),
    ).toEqual({ action: "CANCEL", reason: "plan_version_replaced", disposition: "cancel" });
  });

  it("cancels a non-canonical job type, version, or template", () => {
    for (const patch of [
      { job_type: "stalled" },
      { job_version: "v2" },
      { template_version: "start_day_1_v2" },
    ]) {
      expect(
        resolveStartDayOne(state({ job: { ...job, ...patch } }), AFTER_FLOOR),
      ).toEqual({ action: "CANCEL", reason: "job_not_canonical", disposition: "cancel" });
    }
  });

  it("cancels when no recipient is persisted", () => {
    expect(resolveStartDayOne(state({ hasRecipient: false }), AFTER_FLOOR)).toEqual({
      action: "CANCEL",
      reason: "recipient_missing",
      disposition: "cancel",
    });
  });

  it("suppresses on marketing unsubscribe", () => {
    expect(
      resolveStartDayOne(state({ marketingUnsubscribedAt: FLOOR_ISO }), AFTER_FLOOR),
    ).toEqual({ action: "CANCEL", reason: "marketing_unsubscribed", disposition: "suppress" });
  });

  it("suppresses on hard bounce or complaint suppression", () => {
    expect(resolveStartDayOne(state({ emailSuppressedAt: FLOOR_ISO }), AFTER_FLOOR)).toEqual({
      action: "CANCEL",
      reason: "recipient_suppressed",
      disposition: "suppress",
    });
    expect(resolveStartDayOne(state({ suppressionListed: true }), AFTER_FLOOR)).toEqual({
      action: "CANCEL",
      reason: "recipient_suppressed",
      disposition: "suppress",
    });
  });

  it("defers while Plan Ready is not provider accepted", () => {
    expect(resolveStartDayOne(state({ planReadyAcceptedAt: null }), AFTER_FLOOR)).toEqual({
      action: "CANCEL",
      reason: "plan_ready_not_accepted",
      disposition: "defer",
    });
  });

  it("defers before the normal 24 hour floor and sends at it", () => {
    const justBefore = new Date(Date.parse(FLOOR_ISO) - 1_000);
    expect(resolveStartDayOne(state(), justBefore)).toEqual({
      action: "CANCEL",
      reason: "eligibility_floor_not_reached",
      disposition: "defer",
      eligibleAt: FLOOR_ISO,
    });
    expect(resolveStartDayOne(state(), new Date(FLOOR_ISO))).toEqual({ action: "START" });
  });

  it("moves the floor to acceptance plus 24 hours only for a delayed Plan Ready", () => {
    const lateAccept = new Date(Date.parse(FLOOR_ISO) + 6 * 60 * 60 * 1000);
    const movedFloor = new Date(lateAccept.getTime() + 24 * 60 * 60 * 1000);
    const delayed = state({ planReadyAcceptedAt: lateAccept.toISOString() });

    expect(resolveStartDayOne(delayed, new Date(movedFloor.getTime() - 1_000))).toEqual({
      action: "CANCEL",
      reason: "eligibility_floor_not_reached",
      disposition: "defer",
      eligibleAt: movedFloor.toISOString(),
    });
    expect(resolveStartDayOne(delayed, movedFloor)).toEqual({ action: "START" });

    // Normal acceptance before the original floor never adds another 24 hours.
    expect(resolveStartDayOne(state(), new Date(FLOOR_ISO))).toEqual({ action: "START" });
  });

  it("defers when another lifecycle email was accepted within 24 hours", () => {
    const recent = new Date(AFTER_FLOOR.getTime() - 60 * 60 * 1000);
    expect(
      resolveStartDayOne(state({ lastLifecycleAcceptedAt: recent.toISOString() }), AFTER_FLOOR),
    ).toEqual({
      action: "CANCEL",
      reason: "lifecycle_24h_cap",
      disposition: "defer",
      eligibleAt: new Date(recent.getTime() + LIFECYCLE_MIN_GAP_MS).toISOString(),
    });

    const old = new Date(AFTER_FLOOR.getTime() - LIFECYCLE_MIN_GAP_MS - 1_000);
    expect(
      resolveStartDayOne(state({ lastLifecycleAcceptedAt: old.toISOString() }), AFTER_FLOOR),
    ).toEqual({ action: "START" });
  });

  it("cancels at the three accepted inactivity email cap", () => {
    expect(
      resolveStartDayOne(
        state({ acceptedInactivityCount: MAX_ACCEPTED_INACTIVITY_EMAILS }),
        AFTER_FLOOR,
      ),
    ).toEqual({ action: "CANCEL", reason: "inactivity_cap_reached", disposition: "cancel" });
    expect(
      resolveStartDayOne(
        state({ acceptedInactivityCount: MAX_ACCEPTED_INACTIVITY_EMAILS - 1 }),
        AFTER_FLOOR,
      ),
    ).toEqual({ action: "START" });
  });

  it("ignores provider reporting and passive visit state entirely", () => {
    const noise = {
      ...state(),
      // Fields a provider or a passive visit could produce are not part of the
      // resolver input shape at all, so adding them cannot change the result.
      opened_at: "2026-08-02T00:00:00.000Z",
      clicked_at: "2026-08-02T00:00:00.000Z",
      last_seen_at: "2026-08-02T00:00:00.000Z",
    } as StartDayOneState;
    expect(resolveStartDayOne(noise, AFTER_FLOOR)).toEqual({ action: "START" });
  });

  it("returns no personal or assessment data in the result", () => {
    const result = resolveStartDayOne(state({ dayOneCompletedAt: FLOOR_ISO }), AFTER_FLOOR);
    expect(Object.keys(result).sort()).toEqual(["action", "disposition", "reason"]);
  });
});

type Call = { table: string; columns: string; filters: Array<[string, unknown]> };

function fakeClient(data: Record<string, Record<string, unknown>[]>, calls: Call[]) {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          const call: Call = { table, columns, filters: [] };
          calls.push(call);
          const builder = {
            eq(column: string, value: unknown) {
              call.filters.push([column, value]);
              return builder;
            },
            in() {
              return builder;
            },
            order() {
              return builder;
            },
            limit: async () => ({ data: data[table] ?? [], error: null }),
          };
          return builder;
        },
      };
    },
  };
}

describe("Start Day 1 authoritative state loader", () => {
  it("reads only authoritative persisted tables and never mutates", async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      {
        lead_plans: [
          {
            id: LEAD,
            plan_version_id: VERSION,
            email_original: "person@example.com",
            email_normalized: "person@example.com",
            marketing_unsubscribed_at: null,
            email_suppressed_at: null,
          },
        ],
        lead_plan_day_starts: [{ started_at: FLOOR_ISO }],
        lead_plan_day_completions: [],
        email_jobs: [
          { job_type: "plan_ready", provider_accepted_at: "2026-08-01T00:01:00.000Z" },
          { job_type: "start_day_1", provider_accepted_at: "2026-08-02T00:00:00.000Z" },
        ],
        email_suppressions: [],
      },
      calls,
    );

    const loaded = await loadStartDayOneState(job, client);

    expect(loaded.currentPlanVersionId).toBe(VERSION);
    expect(loaded.hasRecipient).toBe(true);
    expect(loaded.dayOneStartedAt).toBe(FLOOR_ISO);
    expect(loaded.dayOneCompletedAt).toBeNull();
    expect(loaded.planReadyAcceptedAt).toBe("2026-08-01T00:01:00.000Z");
    expect(loaded.lastLifecycleAcceptedAt).toBe("2026-08-02T00:00:00.000Z");
    expect(loaded.acceptedInactivityCount).toBe(1);

    expect([...new Set(calls.map((call) => call.table))].sort()).toEqual([
      "email_jobs",
      "email_suppressions",
      "lead_plan_day_completions",
      "lead_plan_day_starts",
      "lead_plans",
    ]);
    // No assessment or plan content is ever selected.
    for (const call of calls) {
      expect(call.columns).not.toMatch(/assessment_json|plan_json|access_token_hash|first_name/);
    }

    // Lifecycle cap query is scoped to the exact current plan version.
    const lifecycle = calls.find(
      (call) => call.table === "email_jobs" && call.columns.includes("job_type"),
    );
    expect(lifecycle?.filters).toEqual(
      expect.arrayContaining([
        ["lead_plan_id", LEAD],
        ["plan_version_id", VERSION],
      ]),
    );
  });

  it("treats an invalid persisted recipient as missing and cancels", async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      {
        lead_plans: [
          {
            id: LEAD,
            plan_version_id: VERSION,
            email_original: "not-an-email",
            email_normalized: "not-an-email",
            marketing_unsubscribed_at: null,
            email_suppressed_at: null,
          },
        ],
        lead_plan_day_starts: [],
        lead_plan_day_completions: [],
        email_jobs: [],
        email_suppressions: [],
      },
      calls,
    );

    const loaded = await loadStartDayOneState(job, client);
    expect(loaded.hasRecipient).toBe(false);

    expect(resolveStartDayOne(loaded, AFTER_FLOOR)).toEqual({
      action: "CANCEL",
      reason: "recipient_missing",
      disposition: "cancel",
    });
  });
});

