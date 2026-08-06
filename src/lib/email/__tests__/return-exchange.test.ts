// Checkpoint 5 correction: deterministic tests for the exchange boundary itself.
// The Supabase admin client is replaced with a minimal in-memory boundary, so no
// database, provider, or network call happens. Destination is proven where it is
// actually derived (trusted server-side state), not by mocking the route result.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashAccessToken } from "@/lib/lead-plan";
import {
  HALFWAY_JOB_TYPE,
  HALFWAY_JOB_VERSION,
  HALFWAY_TEMPLATE_VERSION,
  PLAN_READY_JOB_TYPE,
  PLAN_READY_JOB_VERSION,
  PLAN_READY_TEMPLATE_VERSION,
  START_DAY_1_JOB_TYPE,
  START_DAY_1_JOB_VERSION,
  START_DAY_1_TEMPLATE_VERSION,
} from "@/lib/email/types";
import {
  HALFWAY_LINK_EXCHANGE_EVENT,
  PLAN_READY_LINK_EXCHANGE_EVENT,
  START_DAY_1_LINK_EXCHANGE_EVENT,
} from "@/lib/email/link-exchange-event";

type Row = Record<string, unknown>;
type Write = { table: string; op: "insert" | "update"; payload: unknown };

const LEAD = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const JOB = "44444444-4444-4444-8444-444444444444";
const TOKEN_ID = "55555555-5555-4555-8555-555555555555";

const RAW = "A".repeat(43);

const state: { rows: Record<string, Row[]>; writes: Write[] } = { rows: {}, writes: [] };

function makeClient() {
  const from = (table: string) => ({
    select: () => {
      const filters: Row = {};
      const query = {
        eq(column: string, value: unknown) {
          filters[column] = value;
          return query;
        },
        limit(_n: number) {
          const rows = (state.rows[table] ?? []).filter((row) =>
            Object.entries(filters).every(([k, v]) => row[k] === v),
          );
          return Promise.resolve({ data: rows, error: null });
        },
      };
      return query;
    },
    insert: (payload: unknown) => {
      state.writes.push({ table, op: "insert", payload });
      return Promise.resolve({ error: null });
    },
    update: (payload: unknown) => ({
      eq: (_column: string, _value: unknown) => {
        state.writes.push({ table, op: "update", payload });
        return Promise.resolve({ error: null });
      },
    }),
  });
  return { supabaseAdmin: { from } };
}

vi.mock("@/integrations/supabase/client.server", () => makeClient());

type Scenario = {
  purpose?: string;
  jobId?: string | null;
  job?: Row | null;
  revokedAt?: string | null;
  expiresAt?: string;
  leadPlanVersionId?: string;
};

async function seed(scenario: Scenario = {}) {
  const tokenHash = await hashAccessToken(RAW);
  state.rows = {
    plan_return_tokens: [
      {
        token_id: TOKEN_ID,
        lead_plan_id: LEAD,
        plan_version_id: VERSION,
        purpose: scenario.purpose ?? "open_plan",
        token_hash: tokenHash,
        expires_at: scenario.expiresAt ?? new Date(Date.now() + 86_400_000).toISOString(),
        revoked_at: scenario.revokedAt ?? null,
        use_count: 0,
        job_id: scenario.jobId === undefined ? JOB : scenario.jobId,
      },
    ],
    lead_plans: [
      {
        id: LEAD,
        plan_version_id: scenario.leadPlanVersionId ?? VERSION,
        email_verified_at: null,
      },
    ],
    email_jobs:
      scenario.job === null
        ? []
        : [
            {
              job_id: JOB,
              job_type: START_DAY_1_JOB_TYPE,
              job_version: START_DAY_1_JOB_VERSION,
              template_version: START_DAY_1_TEMPLATE_VERSION,
              lead_plan_id: LEAD,
              plan_version_id: VERSION,
              ...scenario.job,
            },
          ],
  };
  state.writes = [];
}

async function exchange(raw: string | null) {
  const { exchangeReturnToken } = await import("@/lib/email/return-exchange.server");
  return exchangeReturnToken(raw);
}

describe("exchangeReturnToken rejects unusable tokens with no writes", () => {
  beforeEach(async () => {
    await seed();
  });

  it("rejects a malformed token without touching the database", async () => {
    for (const bad of [null, "", "short", "!".repeat(43), `${RAW}extra`]) {
      const result = await exchange(bad);
      expect(result.ok).toBe(false);
    }
    expect(state.writes).toHaveLength(0);
  });

  it("rejects an unknown token", async () => {
    const result = await exchange("B".repeat(43));
    expect(result.ok).toBe(false);
    expect(state.writes).toHaveLength(0);
  });

  it("rejects an expired token", async () => {
    await seed({ expiresAt: new Date(Date.now() - 1_000).toISOString() });
    const result = await exchange(RAW);
    expect(result.ok).toBe(false);
    expect(state.writes).toHaveLength(0);
  });

  it("rejects a revoked token", async () => {
    await seed({ revokedAt: new Date(Date.now() - 60_000).toISOString() });
    const result = await exchange(RAW);
    expect(result.ok).toBe(false);
    expect(state.writes).toHaveLength(0);
  });

  it("rejects a token whose plan version has been replaced", async () => {
    await seed({ leadPlanVersionId: OTHER });
    const result = await exchange(RAW);
    expect(result.ok).toBe(false);
    expect(state.writes).toHaveLength(0);
  });

  it("writes no session, cookie, or day state for any rejected token", async () => {
    await seed({ revokedAt: new Date().toISOString() });
    const result = await exchange(RAW);
    expect(result).toEqual({ ok: false });
    expect("sessionToken" in result).toBe(false);
    expect("destination" in result).toBe(false);
    const tables = state.writes.map((w) => w.table);
    expect(tables).not.toContain("return_link_sessions");
    expect(tables).not.toContain("lead_plan_day_completions");
    expect(tables).not.toContain("canonical_events");
  });
});

describe("exchangeReturnToken derives the destination from trusted state", () => {
  it("resolves a valid linked start_day_1_v1 token to /your-plan/day/1", async () => {
    await seed();
    const result = await exchange(RAW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.destination).toBe("/your-plan/day/1");
    expect(state.writes.some((w) => w.table === "return_link_sessions")).toBe(true);
  });

  it("resolves a valid Plan Ready linked token to /your-plan", async () => {
    await seed({
      job: { job_type: PLAN_READY_JOB_TYPE, template_version: PLAN_READY_TEMPLATE_VERSION },
    });
    const result = await exchange(RAW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.destination).toBe("/your-plan");
  });

  it("resolves a valid token with no job association to /your-plan", async () => {
    await seed({ jobId: null });
    const result = await exchange(RAW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.destination).toBe("/your-plan");
  });

  it("keeps a recovery-purpose token on /your-plan even with a start_day_1 job", async () => {
    await seed({ purpose: "recovery" });
    const result = await exchange(RAW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.destination).toBe("/your-plan");
  });

  it("keeps a start_day_1 job owned by another lead or version on /your-plan", async () => {
    for (const job of [{ lead_plan_id: OTHER }, { plan_version_id: OTHER }]) {
      await seed({ job });
      const result = await exchange(RAW);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.destination).toBe("/your-plan");
    }
  });

  it("keeps an unknown or mismatched job on /your-plan", async () => {
    await seed({ job: null });
    let result = await exchange(RAW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.destination).toBe("/your-plan");

    await seed({ job: { template_version: "start_day_1_v2" } });
    result = await exchange(RAW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.destination).toBe("/your-plan");
  });

  it("marks no Day 1 start or completion on a successful exchange", async () => {
    await seed();
    await exchange(RAW);
    const tables = state.writes.map((w) => w.table);
    expect(tables).not.toContain("lead_plan_day_completions");
    expect(tables).not.toContain("lead_plan_day_starts");
  });
});

// Attribution proven at the actual exchange boundary: the canonical_events rows
// written by exchangeReturnToken itself, not by the pure selector alone.
function exchangeEvents() {
  return state.writes
    .filter((w) => w.table === "canonical_events" && w.op === "insert")
    .flatMap((w) => (Array.isArray(w.payload) ? (w.payload as Row[]) : [w.payload as Row]));
}

describe("exchangeReturnToken writes exactly one attributed exchange event", () => {
  it("writes the Start Day 1 exchange event with the Start Day 1 job id", async () => {
    await seed();
    const result = await exchange(RAW);
    expect(result.ok).toBe(true);

    const events = exchangeEvents();
    const names = events.map((e) => e.event_name);
    expect(names).toContain(START_DAY_1_LINK_EXCHANGE_EVENT);
    expect(names).toContain("return_session_started");
    expect(names).not.toContain(PLAN_READY_LINK_EXCHANGE_EVENT);
    expect(names).not.toContain(HALFWAY_LINK_EXCHANGE_EVENT);
    expect(names.filter((n) => n === START_DAY_1_LINK_EXCHANGE_EVENT)).toHaveLength(1);

    const attributed = events.find((e) => e.event_name === START_DAY_1_LINK_EXCHANGE_EVENT);
    expect(attributed?.job_id).toBe(JOB);
  });

  it("keeps a Plan Ready exchange on the general event with no attributed job id", async () => {
    await seed({
      job: {
        job_type: PLAN_READY_JOB_TYPE,
        job_version: PLAN_READY_JOB_VERSION,
        template_version: PLAN_READY_TEMPLATE_VERSION,
      },
    });
    const result = await exchange(RAW);
    expect(result.ok).toBe(true);

    const events = exchangeEvents();
    const names = events.map((e) => e.event_name);
    expect(names).toContain(PLAN_READY_LINK_EXCHANGE_EVENT);
    expect(names).toContain("return_session_started");
    expect(names).not.toContain(START_DAY_1_LINK_EXCHANGE_EVENT);
    expect(names).not.toContain(HALFWAY_LINK_EXCHANGE_EVENT);

    const attributed = events.find((e) => e.event_name === PLAN_READY_LINK_EXCHANGE_EVENT);
    expect(attributed?.job_id).toBeNull();
  });

  it("writes the Halfway exchange event with the Halfway job id", async () => {
    await seed({
      job: {
        job_type: HALFWAY_JOB_TYPE,
        job_version: HALFWAY_JOB_VERSION,
        template_version: HALFWAY_TEMPLATE_VERSION,
      },
    });
    const result = await exchange(RAW);
    expect(result.ok).toBe(true);

    const events = exchangeEvents();
    const names = events.map((e) => e.event_name);
    expect(names).toContain(HALFWAY_LINK_EXCHANGE_EVENT);
    expect(names).toContain("return_session_started");
    expect(names).not.toContain(PLAN_READY_LINK_EXCHANGE_EVENT);
    expect(names).not.toContain(START_DAY_1_LINK_EXCHANGE_EVENT);

    const attributed = events.find((e) => e.event_name === HALFWAY_LINK_EXCHANGE_EVENT);
    expect(attributed?.job_id).toBe(JOB);
  });
});
