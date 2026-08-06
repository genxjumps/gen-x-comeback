// Stalled repair checkpoint: authoritative Final Rescue creation guard.
//
// Proven with the strongest mechanism already used in this repository for
// database-boundary behavior: assertions against the committed migration SQL
// (see stalled.test.ts and halfway.test.ts), so the guard is proven where the
// behavior actually lives rather than in a mock.
//
// Deterministic: no database, no network, no sending.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** The originally applied Stalled migration. Forward-only: never edited. */
const ORIGINAL_MIGRATION = "20260806103944_bfb6db47-486a-4447-8985-6dfd022d80b6.sql";
const ORIGINAL_SHA256 = "b38fe2127aedf2306ac14f11d41b34ee961a0eecd85610b5a292ca42cf9e59ef";

/** The forward corrective migration added by this checkpoint. */
const CORRECTIVE_MIGRATION = "20260806121356_e395b63e-208d-4c34-b512-ecdcdd5e1c1c.sql";

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS, name), "utf8");
}

const ORIGINAL_SQL = readMigration(ORIGINAL_MIGRATION);
const SQL = readMigration(CORRECTIVE_MIGRATION);

/** Body of the corrective complete_plan_day_atomic definition. */
const FN = SQL.slice(SQL.indexOf("CREATE OR REPLACE FUNCTION public.complete_plan_day_atomic"));
const ORIGINAL_FN = ORIGINAL_SQL.slice(
  ORIGINAL_SQL.indexOf("CREATE OR REPLACE FUNCTION public.complete_plan_day_atomic"),
);

/** Index helpers over the corrective function body. */
const GUARD = FN.indexOf("final_rescue_job.provider_accepted_at IS NOT NULL");
const GUARD_START = FN.indexOf("FROM public.email_jobs final_rescue_job");
const STALLED_IF = FN.indexOf("-- Stalled candidate lifecycle (7.10.2).");
const STALLED_THEN = FN.indexOf("\n  THEN\n", STALLED_IF);
const CANCELLATION = FN.indexOf("'email_stalled_canceled'");
const CANCEL_UPDATE = FN.indexOf("WITH superseded AS (", STALLED_IF);
const STALLED_INSERT = FN.indexOf("'stalled:' || p_plan_version_id::text");
const QUEUED_EVENT = FN.indexOf("'email_stalled_queued'");
const COMPLETION_INSERT = FN.indexOf("INSERT INTO public.lead_plan_day_completions");
const COUNT_QUERY = FN.indexOf("SELECT count(*)::integer INTO v_count");
const RETURN_QUERY = FN.indexOf("RETURN QUERY SELECT v_count, v_job_id, v_job_id IS NOT NULL;");

describe("R1 forward-only migration chain", () => {
  it("leaves the originally applied Stalled migration byte-for-byte unchanged", () => {
    const digest = createHash("sha256").update(readMigration(ORIGINAL_MIGRATION)).digest("hex");
    expect(digest).toBe(ORIGINAL_SHA256);
  });

  it("adds the guard only in the newer corrective migration", () => {
    expect(ORIGINAL_FN).not.toContain("final_rescue_job");
    expect(CORRECTIVE_MIGRATION > ORIGINAL_MIGRATION).toBe(true);
    expect(FN).toContain("final_rescue_job");
  });

  it("carries the corrective change as CREATE OR REPLACE, never a destructive edit", () => {
    expect(FN).toContain(
      "CREATE OR REPLACE FUNCTION public.complete_plan_day_atomic(p_lead_plan_id uuid, p_plan_version_id uuid, p_day_number smallint)",
    );
    expect(SQL).not.toMatch(/DROP\s+FUNCTION/i);
    expect(SQL).not.toMatch(/DROP\s+TABLE/i);
    expect(SQL).not.toMatch(/DROP\s+INDEX/i);
    expect(SQL).not.toMatch(/DELETE\s+FROM/i);
  });

  it("changes nothing else in the function relative to the synchronized version", () => {
    const guardBlock = FN.slice(
      FN.indexOf("     -- Final Rescue closure is authoritative"),
      FN.indexOf("  THEN\n", GUARD),
    );
    expect(ORIGINAL_FN).toBe(FN.replace(guardBlock, ""));
  });
});

describe("R2 guard is evaluated before any Stalled write", () => {
  it("checks provider-accepted Final Rescue for the same plan version", () => {
    expect(GUARD_START).toBeGreaterThan(-1);
    const guard = FN.slice(GUARD_START, GUARD + 60);
    expect(guard).toContain("final_rescue_job.plan_version_id = p_plan_version_id");
    expect(guard).toContain("final_rescue_job.job_type = 'final_rescue'");
    expect(guard).toContain("final_rescue_job.provider_accepted_at IS NOT NULL");
    expect(FN.slice(STALLED_IF, STALLED_THEN)).toContain("AND NOT EXISTS (");
  });

  it("sits inside the Stalled candidate IF condition, before THEN", () => {
    expect(GUARD).toBeGreaterThan(STALLED_IF);
    expect(GUARD).toBeLessThan(STALLED_THEN);
  });

  it("precedes cancellation, insertion and the queued event", () => {
    for (const after of [CANCEL_UPDATE, CANCELLATION, STALLED_INSERT, QUEUED_EVENT]) {
      expect(after).toBeGreaterThan(GUARD);
    }
  });

  it("blocks the whole Stalled block, so no candidate is created and no queued event fires", () => {
    // Cancellation, insertion and the queued event all live inside the single
    // guarded IF body: a truthy guard is the only path that reaches them.
    const guardedBody = FN.slice(STALLED_THEN, RETURN_QUERY);
    expect(guardedBody).toContain("'email_stalled_canceled'");
    expect(guardedBody).toContain("'stalled_v1',");
    expect(guardedBody).toContain("'email_stalled_queued'");
    // Nothing outside the guarded body can create a Stalled job or event.
    const outside = FN.slice(0, STALLED_IF) + FN.slice(RETURN_QUERY);
    expect(outside).not.toContain("'email_stalled_queued'");
    expect(outside).not.toContain("'email_stalled_canceled'");
    expect(outside).not.toContain("'stalled_v1',");
  });
});

describe("R3 required completion and return behavior stay outside the guard", () => {
  it("persists the required completion before the guard is evaluated", () => {
    expect(COMPLETION_INSERT).toBeGreaterThan(-1);
    expect(COMPLETION_INSERT).toBeLessThan(STALLED_IF);
    expect(COMPLETION_INSERT).toBeLessThan(GUARD);
  });

  it("computes the authoritative count before the guard", () => {
    expect(COUNT_QUERY).toBeGreaterThan(COMPLETION_INSERT);
    expect(COUNT_QUERY).toBeLessThan(GUARD);
  });

  it("returns the unchanged count and Halfway result after the guarded block", () => {
    expect(RETURN_QUERY).toBeGreaterThan(QUEUED_EVENT);
    expect(FN).toContain("RETURN QUERY SELECT v_count, v_job_id, v_job_id IS NOT NULL;");
  });
});

describe("R4 unrelated lifecycle behavior is unchanged", () => {
  it("keeps Halfway creation, anchoring and queued event before the guard", () => {
    const halfwayIf = FN.indexOf("IF v_inserted AND v_count = 4 THEN");
    expect(halfwayIf).toBeGreaterThan(-1);
    expect(halfwayIf).toBeLessThan(GUARD);
    expect(FN.indexOf("'email_halfway_queued'")).toBeLessThan(GUARD);
    expect(FN).toContain("'halfway:' || p_plan_version_id::text || ':v1'");
  });

  it("keeps the partial unique index predicate on the Halfway enqueue", () => {
    expect(FN).toContain(
      "ON CONFLICT (job_type, plan_version_id, job_version) WHERE job_type <> 'stalled' DO NOTHING",
    );
  });

  it("does not touch the Start Day 1 trigger or the partial unique index", () => {
    expect(SQL).not.toContain("enqueue_start_day_1_for_plan_ready");
    expect(SQL).not.toContain("email_jobs_logical_key");
  });

  it("keeps plan-version locking, required-day derivation and sequential progression", () => {
    expect(FN).toContain("FOR UPDATE");
    expect(FN).toContain("jsonb_array_elements(COALESCE(v_plan->'days', '[]'::jsonb))");
    expect(FN).toContain("WHERE r.day_number < p_day_number");
  });

  it("preserves the service-role-only execution boundary", () => {
    expect(SQL).toContain("SECURITY DEFINER");
    expect(SQL).toContain("SET search_path TO 'public'");
    expect(SQL).toContain(
      "REVOKE ALL ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint) FROM PUBLIC;",
    );
    expect(SQL).toContain(
      "REVOKE ALL ON FUNCTION public.complete_plan_day_atomic(uuid, uuid, smallint) FROM anon, authenticated;",
    );
    expect(SQL).toContain("GRANT EXECUTE ON FUNCTION public.complete_plan_day_atomic");
    expect(SQL).toContain("TO service_role;");
  });
});

describe("R5 Stalled behavior still works with no accepted Final Rescue", () => {
  it("keeps the Day 1-6 window, Day 7 exclusion and persisted-completion anchoring", () => {
    const condition = FN.slice(STALLED_IF, STALLED_THEN);
    expect(condition).toContain("AND p_day_number >= 1");
    expect(condition).toContain("AND p_day_number <= 6");
    expect(condition).toContain("WHERE r.day_number > p_day_number");
    expect(condition).toContain("IF v_inserted");
  });

  it("keeps 48-hour eligibility anchored to the persisted completion timestamp", () => {
    expect(FN).toContain("v_completed_at + interval '48 hours'");
  });

  it("keeps prior unsent-candidate cancellation when the guard is absent", () => {
    const guardedBody = FN.slice(STALLED_THEN, RETURN_QUERY);
    expect(guardedBody).toContain("status IN ('pending','processing','retry_scheduled')");
    expect(guardedBody).toContain("SET status = 'canceled'");
    expect(guardedBody).toContain("'email_stalled_canceled'");
  });

  it("keeps the canonical episode key, job identity and queued event", () => {
    const guardedBody = FN.slice(STALLED_THEN, RETURN_QUERY);
    expect(guardedBody).toContain(
      "'stalled:' || p_plan_version_id::text || ':after_day:' || p_day_number::text || ':v1'",
    );
    expect(guardedBody).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    expect(guardedBody).toContain("'email_stalled_queued'");
  });
});
