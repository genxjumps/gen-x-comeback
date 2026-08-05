import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const migration = source(
  "../../../supabase/migrations/20260804010000_day_1_start_state.sql",
).replace(/\s+/g, " ");
const leadFunctions = source("../lead.functions.ts");
const planHub = source("../../routes/your-plan.index.tsx");
const dayRoute = source("../../routes/your-plan.day.$day.tsx");
const dayOneWorkout = source("../../components/day-one-workout.tsx");

describe("Day 1 start contract", () => {
  it("stores one authoritative Day 1 start per exact plan version", () => {
    expect(migration).toContain("CREATE TABLE public.lead_plan_day_starts");
    expect(migration).toContain("CHECK (day_number = 1)");
    expect(migration).toContain("UNIQUE (plan_version_id, day_number)");
    expect(migration).toContain(
      "WHERE id = p_lead_plan_id AND plan_version_id = p_plan_version_id FOR UPDATE",
    );
    expect(migration).toContain("ON CONFLICT (plan_version_id, day_number) DO NOTHING");
  });

  it("rejects stale or completed state and emits day_1_started only for the winning insert", () => {
    expect(migration).toContain(
      "FROM public.lead_plan_day_completions WHERE lead_plan_id = p_lead_plan_id AND day_number = 1",
    );
    expect(migration).toContain("IF v_started_at IS NOT NULL THEN");
    expect(migration).toContain("'day_1_started'");
    expect(migration).toContain("canonical_events_day_1_started_key");
  });

  it("keeps the database write boundary service-role only", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.mark_day_1_started(uuid, uuid) FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.mark_day_1_started(uuid, uuid) TO service_role",
    );
  });

  it("exposes activation only through a deliberate POST action", () => {
    expect(leadFunctions).toContain(
      'export const startDayOne = createServerFn({ method: "POST" })',
    );
    expect(planHub).toContain("onClick={openDayOne}");
    expect(planHub).toContain("await recordDayOneStart(");
  });

  it("keeps passive Day 1 route loads read-only", () => {
    expect(dayRoute).not.toContain("startDayOne");
    expect(dayRoute).not.toContain("recordDayOneStart");
    expect(dayOneWorkout).not.toContain("startDayOne");
    expect(dayOneWorkout).not.toContain("recordDayOneStart");

    const briefStart = leadFunctions.indexOf("export const getDayOneBrief");
    const briefEnd = leadFunctions.indexOf("export const getDayBrief", briefStart);
    const brief = leadFunctions.slice(briefStart, briefEnd);
    expect(brief).not.toContain("recordDayOneStart");
  });

  it("treats a deliberate Day 1 completion as activation before completion is saved", () => {
    const completionStart = leadFunctions.indexOf("export const completePlanDay");
    const completionEnd = leadFunctions.indexOf(
      "async function requestFingerprint",
      completionStart,
    );
    const completion = leadFunctions.slice(completionStart, completionEnd);

    expect(completion).toContain("if (data.day === 1 && !already.includes(1))");
    const startCall = completion.indexOf("await recordDayOneStart(");
    // The completion itself is now written by the atomic completion boundary.
    const completionWrite = completion.indexOf('rpc("complete_plan_day_atomic"');
    expect(startCall).toBeGreaterThan(-1);
    expect(completionWrite).toBeGreaterThan(startCall);
  });
});
