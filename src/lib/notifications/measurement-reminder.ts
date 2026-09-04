import type { CustomerMeasurement } from "@/lib/accelerator/types";

export type MeasurementReminder = {
  code: "weekly_measurement";
  enrollmentId: string;
  programWeek: 2 | 3 | 4;
  title: string;
  message: string;
};

export type MeasurementReminderInput = {
  enrollmentId: string;
  runStatus: "active" | "paused" | "completed";
  currentDay: number | null;
  canCompleteCurrent: boolean;
  weekBoundaryCompletedAt: string | null;
  measurements: CustomerMeasurement[];
  dismissed: boolean;
};

export function programWeekForDay(day: number | null): 1 | 2 | 3 | 4 | null {
  if (day === null || day < 1 || day > 28) return null;
  return Math.ceil(day / 7) as 1 | 2 | 3 | 4;
}

export function buildMeasurementReminder(
  input: MeasurementReminderInput,
): MeasurementReminder | null {
  const programWeek = programWeekForDay(input.currentDay);
  if (
    input.runStatus !== "active" ||
    !input.canCompleteCurrent ||
    programWeek === null ||
    programWeek === 1 ||
    !input.weekBoundaryCompletedAt ||
    input.dismissed
  ) {
    return null;
  }

  const boundary = Date.parse(input.weekBoundaryCompletedAt);
  if (!Number.isFinite(boundary)) return null;
  const hasCurrentWeekMeasurement = input.measurements.some(
    (measurement) =>
      measurement.enrollmentId === input.enrollmentId &&
      measurement.context === "progress" &&
      Date.parse(measurement.measuredAt) >= boundary,
  );
  if (hasCurrentWeekMeasurement) return null;

  return {
    code: "weekly_measurement",
    enrollmentId: input.enrollmentId,
    programWeek,
    title: `Week ${programWeek} measurement check-in`,
    message: "You haven’t added your weight or waist this program week.",
  };
}
