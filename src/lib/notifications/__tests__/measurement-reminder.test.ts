import { describe, expect, it } from "vitest";

import {
  buildMeasurementReminder,
  programWeekForDay,
  type MeasurementReminderInput,
} from "../measurement-reminder";
import type { CustomerMeasurement } from "@/lib/accelerator/types";

const RUN = "00000000-0000-4000-8000-000000000001";
const OTHER_RUN = "00000000-0000-4000-8000-000000000002";
const BOUNDARY = "2026-09-01T12:00:00Z";

function measurement(
  measuredAt: string,
  context: CustomerMeasurement["context"] = "progress",
  enrollmentId: string | null = RUN,
): CustomerMeasurement {
  return {
    id: `measurement-${measuredAt}`,
    enrollmentId,
    kind: "weight",
    value: 185,
    unit: "lb",
    context,
    notes: null,
    measuredAt,
    createdAt: measuredAt,
  };
}

function input(overrides: Partial<MeasurementReminderInput> = {}): MeasurementReminderInput {
  return {
    enrollmentId: RUN,
    runStatus: "active",
    currentDay: 8,
    canCompleteCurrent: true,
    weekBoundaryCompletedAt: BOUNDARY,
    measurements: [],
    dismissed: false,
    ...overrides,
  };
}

describe("program-week measurement reminder", () => {
  it("maps program days to the four program weeks", () => {
    expect(programWeekForDay(1)).toBe(1);
    expect(programWeekForDay(7)).toBe(1);
    expect(programWeekForDay(8)).toBe(2);
    expect(programWeekForDay(21)).toBe(3);
    expect(programWeekForDay(28)).toBe(4);
    expect(programWeekForDay(null)).toBeNull();
    expect(programWeekForDay(29)).toBeNull();
  });

  it("starts in week 2 and follows program progress rather than calendar weeks", () => {
    expect(buildMeasurementReminder(input({ currentDay: 7 }))).toBeNull();
    expect(buildMeasurementReminder(input({ currentDay: 8 }))).toMatchObject({
      enrollmentId: RUN,
      programWeek: 2,
      code: "weekly_measurement",
    });
    expect(buildMeasurementReminder(input({ currentDay: 15 }))).toMatchObject({ programWeek: 3 });
    expect(buildMeasurementReminder(input({ currentDay: 22 }))).toMatchObject({ programWeek: 4 });
  });

  it("does not remind for paused, completed, or not-yet-available work", () => {
    expect(buildMeasurementReminder(input({ runStatus: "paused" }))).toBeNull();
    expect(buildMeasurementReminder(input({ runStatus: "completed" }))).toBeNull();
    expect(buildMeasurementReminder(input({ canCompleteCurrent: false }))).toBeNull();
    expect(buildMeasurementReminder(input({ weekBoundaryCompletedAt: null }))).toBeNull();
  });

  it("accepts either weight or waist as the optional weekly check-in", () => {
    expect(
      buildMeasurementReminder(input({ measurements: [measurement("2026-09-02T12:00:00Z")] })),
    ).toBeNull();
    expect(
      buildMeasurementReminder(
        input({
          measurements: [{ ...measurement("2026-09-02T12:00:00Z"), kind: "waist", unit: "in" }],
        }),
      ),
    ).toBeNull();
  });

  it("ignores old, starting, general, and other-run measurements", () => {
    const reminder = buildMeasurementReminder(
      input({
        measurements: [
          measurement("2026-08-31T12:00:00Z"),
          measurement("2026-09-02T12:00:00Z", "starting"),
          measurement("2026-09-02T12:00:00Z", "general"),
          measurement("2026-09-02T12:00:00Z", "progress", OTHER_RUN),
        ],
      }),
    );
    expect(reminder).not.toBeNull();
  });

  it("silences only the dismissed program week", () => {
    expect(buildMeasurementReminder(input({ dismissed: true }))).toBeNull();
    expect(buildMeasurementReminder(input({ currentDay: 15, dismissed: false }))).toMatchObject({
      programWeek: 3,
    });
  });
});
