import type {
  CustomerMeasurement,
  MeasurementKind,
  MeasurementPair,
  MeasurementSummary,
} from "@/lib/accelerator/types";

function newest(measurements: CustomerMeasurement[]): CustomerMeasurement | null {
  return (
    [...measurements].sort((left, right) => {
      const measured = Date.parse(right.measuredAt) - Date.parse(left.measuredAt);
      if (measured !== 0) return measured;
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })[0] ?? null
  );
}

function pair(
  measurements: CustomerMeasurement[],
  predicate: (measurement: CustomerMeasurement) => boolean,
): MeasurementPair {
  const latest = (kind: MeasurementKind) =>
    newest(
      measurements.filter((measurement) => measurement.kind === kind && predicate(measurement)),
    );
  return { weight: latest("weight"), waist: latest("waist") };
}

/**
 * Derives the four approved measurement views from active logical entries.
 * Removed values are excluded by the server query while their revisions stay
 * preserved in the backend audit trail.
 */
export function measurementSummary(
  measurements: CustomerMeasurement[],
  enrollmentId: string,
): MeasurementSummary {
  return {
    globalLatest: pair(measurements, () => true),
    runStarting: pair(
      measurements,
      (measurement) =>
        measurement.enrollmentId === enrollmentId && measurement.context === "starting",
    ),
    runNewest: pair(measurements, (measurement) => measurement.enrollmentId === enrollmentId),
    runFinal: pair(
      measurements,
      (measurement) => measurement.enrollmentId === enrollmentId && measurement.context === "final",
    ),
  };
}
