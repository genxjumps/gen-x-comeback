import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  isoDateInTimeZone,
  planDayHeading,
  planDayTiming,
  type PlanCalendar,
  type PlanDayView,
} from "@/lib/lead-plan";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const movement: PlanDayView = {
  day: 2,
  code: null,
  title: "Walk or easy movement",
  description: null,
  minutes: null,
  optional: null,
};

function calendar(today: string): PlanCalendar {
  return { startOn: "2026-09-09", today, timeZone: "America/New_York" };
}

describe("7-Day Plan calendar access", () => {
  it("uses local calendar dates rather than elapsed 24-hour windows", () => {
    expect(isoDateInTimeZone(new Date("2026-09-10T03:59:00Z"), "America/New_York")).toBe(
      "2026-09-09",
    );
    expect(isoDateInTimeZone(new Date("2026-09-10T04:01:00Z"), "America/New_York")).toBe(
      "2026-09-10",
    );
  });

  it("calls the next day tomorrow, today, then the user's next day when missed", () => {
    const tomorrow = planDayTiming(calendar("2026-09-09"), 2);
    expect(tomorrow).toMatchObject({ availableOn: "2026-09-10", relation: "tomorrow" });
    expect(planDayHeading(movement, tomorrow)).toBe("Tomorrow’s Movement");

    const today = planDayTiming(calendar("2026-09-10"), 2);
    expect(today.available).toBe(true);
    expect(planDayHeading(movement, today)).toBe("Today’s Movement");

    const missed = planDayTiming(calendar("2026-09-11"), 2);
    expect(missed.relation).toBe("past");
    expect(planDayHeading(movement, missed)).toBe("Your Next Movement");
  });

  it("enforces calendar availability on the server before atomic completion", () => {
    const functions = source("../lead.functions.ts");
    const availability = functions.indexOf("leadPlanDayAvailable(");
    const completion = functions.indexOf('rpc("complete_plan_day_atomic"');
    expect(availability).toBeGreaterThan(-1);
    expect(completion).toBeGreaterThan(availability);
  });

  it("locks future video playback and removes redundant short-page navigation", () => {
    const assignment = source("../../components/day-assignment.tsx");
    const dayOne = source("../../components/day-one-workout.tsx");
    expect(assignment).toContain("src && !lockedLabel");
    expect(assignment).toContain("Your workout opens on schedule.");
    expect(assignment).toContain('!completed && (kind === "workout"');
    expect(dayOne).toContain("{!completed ? (");
  });

  it("defines a forward-only database calendar and service-role access boundary", () => {
    const migration = source(
      "../../../supabase/migrations/20260909161000_lead_plan_calendar_access.sql",
    );
    expect(migration).toContain("plan_time_zone text NOT NULL DEFAULT 'UTC'");
    expect(migration).toContain("plan_start_on + (p_day_number - 1)");
    expect(migration).toContain("pg_timezone_names");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.lead_plan_day_is_available(uuid, uuid, integer)",
    );
  });
});
