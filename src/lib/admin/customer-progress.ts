import { latestMeasurementPair, measurementSummary } from "@/lib/accelerator/measurements";
import type { CustomerMeasurement, MeasurementPair } from "@/lib/accelerator/types";

export type AdminProgramStatus = "not_started" | "active" | "paused" | "completed";

export type AdminEnrollment = {
  id: string;
  runNumber: number;
  status: "active" | "paused" | "completed";
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
};

export type AdminCompletion = {
  enrollmentId: string;
  dayNumber: number;
  completedAt: string;
};

export type AdminCustomerProgress = {
  customerId: string;
  displayName: string;
  enrolledAt: string;
  programName: "28-Day Fat Loss Accelerator";
  status: AdminProgramStatus;
  runNumber: number | null;
  currentDay: number | null;
  completedDays: number;
  lastCompletedDay: number | null;
  lastCompletedAt: string | null;
  lastActivityAt: string;
  inactiveDays: number | null;
  measurements: {
    starting: MeasurementPair;
    latest: MeasurementPair;
    final: MeasurementPair;
  };
};

function dateValue(value: string | null | undefined): number {
  return value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.NEGATIVE_INFINITY;
}

function latestTimestamp(...values: (string | null | undefined)[]): string | null {
  const latest = values.reduce<string | null>(
    (current, value) => (dateValue(value) > dateValue(current) ? (value ?? null) : current),
    null,
  );
  return latest;
}

function currentEnrollment(enrollments: AdminEnrollment[]): AdminEnrollment | null {
  const rank: Record<AdminEnrollment["status"], number> = {
    active: 0,
    paused: 1,
    completed: 2,
  };
  return (
    [...enrollments].sort((left, right) => {
      const statusDifference = rank[left.status] - rank[right.status];
      if (statusDifference !== 0) return statusDifference;
      return right.runNumber - left.runNumber;
    })[0] ?? null
  );
}

function emptyMeasurements(): MeasurementPair {
  return { weight: null, waist: null };
}

/**
 * Produces the deliberately small, read-only summary used by Todd's private
 * customer-progress view. The caller has already established private access.
 */
export function buildAdminCustomerProgress(input: {
  customerId: string;
  firstName: string | null;
  enrolledAt: string;
  enrollments: AdminEnrollment[];
  completions: AdminCompletion[];
  measurements: CustomerMeasurement[];
  now: Date;
}): AdminCustomerProgress {
  const enrollment = currentEnrollment(input.enrollments);
  const enrollmentCompletions = enrollment
    ? input.completions.filter((completion) => completion.enrollmentId === enrollment.id)
    : [];
  const lastCompletion = [...enrollmentCompletions].sort(
    (left, right) => dateValue(right.completedAt) - dateValue(left.completedAt),
  )[0];
  const completedDays = enrollmentCompletions.length;
  const highestCompletedDay = enrollmentCompletions.reduce(
    (highest, completion) => Math.max(highest, completion.dayNumber),
    0,
  );
  const status: AdminProgramStatus = enrollment?.status ?? "not_started";
  const currentDay =
    !enrollment || status === "completed" ? null : Math.min(28, highestCompletedDay + 1);
  const lastActivityAt =
    latestTimestamp(
      enrollment?.startedAt,
      enrollment?.pausedAt,
      enrollment?.completedAt,
      lastCompletion?.completedAt,
      input.enrolledAt,
    ) ?? input.enrolledAt;
  const inactiveDays =
    status === "active"
      ? Math.max(0, Math.floor((input.now.getTime() - dateValue(lastActivityAt)) / 86_400_000))
      : null;
  const summary = enrollment
    ? measurementSummary(input.measurements, enrollment.id)
    : {
        globalLatest: latestMeasurementPair(input.measurements),
        runStarting: emptyMeasurements(),
        runNewest: emptyMeasurements(),
        runFinal: emptyMeasurements(),
      };

  return {
    customerId: input.customerId,
    displayName: input.firstName?.trim() || "Customer",
    enrolledAt: input.enrolledAt,
    programName: "28-Day Fat Loss Accelerator",
    status,
    runNumber: enrollment?.runNumber ?? null,
    currentDay,
    completedDays,
    lastCompletedDay: lastCompletion?.dayNumber ?? null,
    lastCompletedAt: lastCompletion?.completedAt ?? null,
    lastActivityAt,
    inactiveDays,
    measurements: {
      starting: summary.runStarting,
      latest: summary.globalLatest,
      final: summary.runFinal,
    },
  };
}

export function sortAdminCustomerProgress(
  customers: AdminCustomerProgress[],
): AdminCustomerProgress[] {
  return [...customers].sort((left, right) => {
    const activityDifference = dateValue(right.lastActivityAt) - dateValue(left.lastActivityAt);
    if (activityDifference !== 0) return activityDifference;
    return left.displayName.localeCompare(right.displayName);
  });
}
