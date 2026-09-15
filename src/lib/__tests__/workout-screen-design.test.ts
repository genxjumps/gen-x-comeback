import { describe, expect, it } from "vitest";

import { sevenDayWorkoutOverview } from "@/lib/workout-presentation";

describe("shared workout-screen presentation", () => {
  it("uses the approved four-fact overview for standard workouts", () => {
    expect(sevenDayWorkoutOverview("W03", 15)).toEqual([
      { label: "Duration", value: "15 Minutes" },
      { label: "Equipment", value: "Jump Rope + Body Weight" },
      { label: "Training", value: "Conditioning + Strength" },
      { label: "Format", value: "Intervals + Circuits" },
    ]);
  });

  it("keeps active recovery distinct without introducing gym equipment", () => {
    const overview = sevenDayWorkoutOverview("W07", 15);
    expect(overview).toContainEqual({
      label: "Equipment",
      value: "Jump Rope Optional + Body Weight",
    });
    expect(overview).toContainEqual({ label: "Training", value: "Recovery + Mobility" });
    expect(overview).toContainEqual({ label: "Format", value: "Guided Movement" });
    expect(JSON.stringify(overview).toLowerCase()).not.toContain("dumbbell");
  });
});
