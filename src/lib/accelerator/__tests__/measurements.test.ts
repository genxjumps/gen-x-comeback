import { describe, expect, it } from "vitest";

import { latestMeasurementPair, measurementChange, measurementSummary } from "../measurements";
import type { CustomerMeasurement } from "../types";

const RUN = "00000000-0000-4000-8000-000000000001";
const OTHER_RUN = "00000000-0000-4000-8000-000000000002";

function measurement(
  id: string,
  kind: "weight" | "waist",
  value: number,
  context: "general" | "starting" | "progress" | "final",
  measuredAt: string,
  enrollmentId: string | null = RUN,
): CustomerMeasurement {
  return {
    id,
    enrollmentId,
    kind,
    value,
    unit: kind === "weight" ? "lb" : "in",
    context,
    notes: null,
    measuredAt,
    createdAt: measuredAt,
  };
}

describe("measurement summaries", () => {
  it("keeps weight and waist independently optional", () => {
    const summary = measurementSummary(
      [measurement("weight-start", "weight", 190, "starting", "2026-08-01T12:00:00Z")],
      RUN,
    );
    expect(summary.runStarting.weight?.value).toBe(190);
    expect(summary.runStarting.waist).toBeNull();
  });

  it("selects the latest available weight and waist independently for repeat setup", () => {
    const latest = latestMeasurementPair([
      measurement("old-weight", "weight", 190, "starting", "2026-08-01T12:00:00Z"),
      measurement("new-waist", "waist", 36.5, "final", "2026-08-28T12:01:00Z"),
      measurement("new-weight", "weight", 184, "final", "2026-08-28T12:00:00Z"),
    ]);

    expect(latest.weight?.id).toBe("new-weight");
    expect(latest.waist?.id).toBe("new-waist");
  });

  it("distinguishes global latest, run starting, run newest, and run final", () => {
    const summary = measurementSummary(
      [
        measurement("weight-start", "weight", 190, "starting", "2026-08-01T12:00:00Z"),
        measurement("waist-start", "waist", 38, "starting", "2026-08-01T12:01:00Z"),
        measurement("weight-progress", "weight", 187, "progress", "2026-08-14T12:00:00Z"),
        measurement("weight-final", "weight", 184, "final", "2026-08-28T12:00:00Z"),
        measurement("waist-final", "waist", 36.5, "final", "2026-08-28T12:01:00Z"),
        measurement("global-weight", "weight", 183, "progress", "2026-08-30T12:00:00Z", OTHER_RUN),
      ],
      RUN,
    );

    expect(summary.globalLatest.weight?.id).toBe("global-weight");
    expect(summary.globalLatest.waist?.id).toBe("waist-final");
    expect(summary.runStarting.weight?.id).toBe("weight-start");
    expect(summary.runNewest.weight?.id).toBe("weight-final");
    expect(summary.runFinal.waist?.id).toBe("waist-final");
  });

  it("uses the corrected active entry and naturally excludes a removed entry", () => {
    const corrected = measurement(
      "weight-progress",
      "weight",
      186.5,
      "progress",
      "2026-08-14T12:00:00Z",
    );
    const summary = measurementSummary([corrected], RUN);
    expect(summary.runNewest.weight?.value).toBe(186.5);
    expect(summary.runNewest.waist).toBeNull();
  });

  it("calculates start-to-finish changes in the final measurement unit", () => {
    const pounds = measurement("start-lb", "weight", 220.462, "starting", "2026-08-01T12:00:00Z");
    const kilograms = {
      ...measurement("final-kg", "weight", 95, "final", "2026-08-28T12:00:00Z"),
      unit: "kg" as const,
    };
    const change = measurementChange(pounds, kilograms);
    expect(change?.unit).toBe("kg");
    expect(change?.value).toBeCloseTo(-5, 2);
  });
});
