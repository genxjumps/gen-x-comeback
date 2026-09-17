import type {
  CustomerMeasurement,
  MeasurementKind,
  MeasurementPair,
  MeasurementSummary,
} from "@/lib/accelerator/types";

const POUNDS_PER_KILOGRAM = 2.2046226218;
const CENTIMETERS_PER_INCH = 2.54;

export type MeasurementChange = { value: number; unit: "lb" | "kg" | "in" | "cm" };

/** Returns final minus starting, expressed in the final measurement's unit. */
export function measurementChange(
  starting: CustomerMeasurement | null,
  final: CustomerMeasurement | null,
): MeasurementChange | null {
  if (!starting || !final || starting.kind !== final.kind) return null;
  let startingInFinalUnit = starting.value;
  if (starting.unit !== final.unit) {
    if (starting.unit === "lb" && final.unit === "kg")
      startingInFinalUnit = starting.value / POUNDS_PER_KILOGRAM;
    else if (starting.unit === "kg" && final.unit === "lb")
      startingInFinalUnit = starting.value * POUNDS_PER_KILOGRAM;
    else if (starting.unit === "in" && final.unit === "cm")
      startingInFinalUnit = starting.value * CENTIMETERS_PER_INCH;
    else if (starting.unit === "cm" && final.unit === "in")
      startingInFinalUnit = starting.value / CENTIMETERS_PER_INCH;
    else return null;
  }
  return { value: final.value - startingInFinalUnit, unit: final.unit };
}

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

export function latestMeasurementPair(measurements: CustomerMeasurement[]): MeasurementPair {
  return pair(measurements, () => true);
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
    globalLatest: latestMeasurementPair(measurements),
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
