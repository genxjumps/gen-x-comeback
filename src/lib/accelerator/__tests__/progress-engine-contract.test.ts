import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const rawMigration = source(
  "../../../../supabase/migrations/20260828180000_accelerator_enrollment_progress.sql",
);
const migration = rawMigration.replace(/\s+/g, " ");
const functions = source("../functions.ts");
const privateProgram = source("../../../components/accelerator-program.tsx");

describe("Accelerator progress engine contract", () => {
  it("captures a valid customer time zone and unlocks on the next local calendar date", () => {
    expect(migration).toContain("customer_time_zone text NOT NULL");
    expect(migration).toContain(
      "SELECT 1 FROM pg_timezone_names WHERE name = p_customer_time_zone",
    );
    expect(migration).toContain(
      "(v_previous_completed_at AT TIME ZONE v_enrollment.customer_time_zone)::date + 1",
    );
    expect(migration).toContain(
      "(now() AT TIME ZONE v_enrollment.customer_time_zone)::date >= available_on",
    );
  });

  it("keeps the earliest unfinished day current instead of skipping or stacking missed days", () => {
    expect(migration).toContain("WHERE NOT ((day.value->>'day')::smallint = ANY(completed_days))");
    expect(migration).toContain("ORDER BY (day.value->>'day')::smallint LIMIT 1");
    expect(migration).toContain("p_day_number <> v_current_day");
  });

  it("limits undo to the latest completion and a short stored window", () => {
    expect(migration).toContain("undo_until = completed_at + interval '10 minutes'");
    expect(migration).toContain("ORDER BY completion.day_number DESC LIMIT 1 FOR UPDATE");
    expect(migration).toContain(
      "v_latest.day_number <> p_day_number OR v_latest.undo_until < now()",
    );
    expect(migration).toContain(
      "DELETE FROM public.paid_program_day_completions WHERE id = v_latest.id",
    );
    expect(functions).toContain("undo_accelerator_day_atomic");
  });

  it("stores video views separately and never treats them as completion", () => {
    const videoFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.record_accelerator_video_view_atomic"),
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.save_accelerator_weekly_check_in_atomic",
      ),
    );
    expect(migration).toContain("CREATE TABLE public.paid_program_video_views");
    expect(videoFunction).toContain("INSERT INTO public.paid_program_video_views");
    expect(videoFunction).toContain("p_day_number = ANY(v_completed_days)");
    expect(videoFunction).toContain("p_day_number = v_current_day AND v_can_complete_current");
    expect(videoFunction).not.toContain("INSERT INTO public.paid_program_day_completions");
    expect(videoFunction).not.toContain("SET status = 'completed'");
    expect(functions).toContain("record_accelerator_video_view_atomic");
  });

  it("keeps completed days reopenable while future days remain server-locked", () => {
    expect(functions).toContain("completedDays: progress.completed_days");
    expect(privateProgram).toContain(
      'day.access === "current" && !hub.progress.canCompleteCurrent',
    );
    expect(privateProgram).not.toContain("completedDays.pop");
  });

  it("switches between a linked 7-Day Plan and paid run without resetting progress", () => {
    const switchFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.activate_lead_plan_atomic"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.accelerator_progress_state"),
    );
    expect(switchFunction).toContain("public.customer_lead_plan_links");
    expect(switchFunction).toContain("SET status = 'paused'");
    expect(switchFunction).toContain("INSERT INTO public.customer_active_programs");
    expect(switchFunction).not.toContain("DELETE FROM public.lead_plan_day_completions");
    expect(switchFunction).not.toContain("DELETE FROM public.paid_program_day_completions");
  });

  it("does not alter the live 7-Day completion or email transaction", () => {
    expect(rawMigration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.complete_plan_day_atomic",
    );
    expect(rawMigration).not.toMatch(/resend|mailerlite|provider call/i);
  });
});
