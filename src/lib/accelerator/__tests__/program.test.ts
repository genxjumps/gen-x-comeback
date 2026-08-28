import { describe, expect, it } from "vitest";

import {
  ACCELERATOR_AVAILABILITY,
  ACCELERATOR_ASSIGNMENTS,
  ACCELERATOR_DAYS,
  ACCELERATOR_EQUIPMENT,
  ACCELERATOR_LAUNCH_REQUIREMENTS,
  ACCELERATOR_OFFER,
  ACCELERATOR_WEEK_FOCUS,
  acceleratorDayAccess,
  acceleratorLaunchReady,
} from "../program";

describe("28-Day Accelerator product contract", () => {
  it("locks the honest one-time offer without expanding the lifetime promise", () => {
    expect(ACCELERATOR_OFFER).toEqual({
      priceCents: 3_700,
      currency: "USD",
      billing: "one_time",
      refundWindowDays: 7,
      access: "completion_based",
      expiresWhileActive: false,
      includedUpdates: "same_product_only",
    });
  });

  it("builds four complete seven-day weeks", () => {
    expect(ACCELERATOR_DAYS).toHaveLength(28);
    expect(ACCELERATOR_WEEK_FOCUS.map(({ title }) => title)).toEqual([
      "Set Your Baseline",
      "Clean It Up",
      "Raise Your Output",
      "Finish Strong",
    ]);

    for (const week of [1, 2, 3, 4]) {
      expect(ACCELERATOR_DAYS.filter((day) => day.week === week)).toHaveLength(7);
    }
  });

  it("preserves the approved workout formats and equipment direction", () => {
    expect(Object.values(ACCELERATOR_ASSIGNMENTS).map(({ label }) => label)).toEqual([
      "Workout A - Classic Intervals",
      "Workout B - EMOM",
      "Workout C - Lower Body Ladder",
      "Workout D - Intervals",
      "Workout E - Pyramid Challenge",
      "Workout F - Active Recovery",
      "Rest Day",
    ]);
    expect(ACCELERATOR_EQUIPMENT).toEqual({
      program: "Jump rope + bodyweight",
      gymRequired: false,
    });
  });

  it("repeats five workouts, optional-video recovery, and rest each week", () => {
    for (const week of [1, 2, 3, 4]) {
      const days = ACCELERATOR_DAYS.filter((day) => day.week === week);
      expect(days.map(({ assignment }) => assignment)).toEqual([
        "workout_a",
        "workout_b",
        "workout_c",
        "workout_d",
        "workout_e",
        "active_recovery_f",
        "rest",
      ]);
      expect(days[5]).toMatchObject({
        kind: "active_recovery",
        videoRequired: false,
        acknowledgementRequired: true,
      });
      expect(days[6]).toMatchObject({
        kind: "rest",
        videoRequired: false,
        acknowledgementRequired: true,
      });
    }
  });

  it("unlocks only the first incomplete day", () => {
    const access = acceleratorDayAccess(new Set([1, 2, 3]));

    expect(access.slice(0, 5).map((day) => day.access)).toEqual([
      "completed",
      "completed",
      "completed",
      "current",
      "locked",
    ]);
  });

  it("does not let an out-of-order completion skip the sequence", () => {
    const access = acceleratorDayAccess(new Set([1, 3, 4]));

    expect(access[0].access).toBe("completed");
    expect(access[1].access).toBe("current");
    expect(access[2].access).toBe("locked");
  });

  it("has no current day after all 28 days are complete", () => {
    const access = acceleratorDayAccess(new Set(ACCELERATOR_DAYS.map(({ day }) => day)));

    expect(access.every((day) => day.access === "completed")).toBe(true);
  });

  it("keeps public enrollment closed while launch evidence is unverified", () => {
    expect(ACCELERATOR_AVAILABILITY.publicEnrollment).toBe(false);
    expect(acceleratorLaunchReady(ACCELERATOR_LAUNCH_REQUIREMENTS)).toBe(false);
  });

  it("requires every named launch requirement before reporting ready", () => {
    const verified = ACCELERATOR_LAUNCH_REQUIREMENTS.map((requirement) => ({
      ...requirement,
      status: "verified" as const,
    }));

    expect(acceleratorLaunchReady(verified)).toBe(true);
    expect(acceleratorLaunchReady(verified.slice(1))).toBe(false);
  });
});
