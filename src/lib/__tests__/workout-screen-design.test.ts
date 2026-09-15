import { describe, expect, it } from "vitest";

import { sevenDayWorkoutOverview, sevenDayWorkoutRuntime } from "@/lib/workout-presentation";

describe("shared workout-screen presentation", () => {
  it("uses the approved four-fact overview for standard workouts", () => {
    expect(sevenDayWorkoutOverview("W03", 15)).toEqual([
      { label: "Duration", value: "14:03" },
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

  it("uses the measured runtime of every configured workout video", () => {
    expect(
      ["W01", "W02", "W03", "W04", "W05", "W06", "W07"].map((code) => sevenDayWorkoutRuntime(code)),
    ).toEqual(["15:05", "14:30", "14:03", "14:03", "14:00", "14:29", "14:09"]);
  });
});
