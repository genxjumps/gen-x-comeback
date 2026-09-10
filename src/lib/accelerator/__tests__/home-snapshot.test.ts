import { describe, expect, it } from "vitest";
import { homeAssignment } from "../home-snapshot";
import type { MyProgramsResult } from "../types";

const empty: Extract<MyProgramsResult, { ok: true }> = {
  ok: true,
  firstName: "Test",
  accelerator: null,
  leadPlans: [],
  activeProgram: null,
  latestMeasurements: { weight: null, waist: null },
};

describe("homepage next step", () => {
  it("keeps an unavailable account distinct from an account without programs", () => {
    expect(homeAssignment({ ok: false }, null).title).toContain("couldn’t be loaded");
    expect(homeAssignment(empty, null).to).toBe("/programs");
  });
  it("shows saved paused progress instead of an empty workout", () => {
    const card = homeAssignment(
      {
        ...empty,
        leadPlans: [{ leadPlanId: "plan", status: "paused", completedDays: 3, totalDays: 7 }],
      },
      null,
    );
    expect(card.title).toContain("paused");
    expect(card.description).toContain("3 of 7");
    expect(card.to).toBe("/my-programs");
  });
  it("does not offer a refunded account an owned program", () => {
    expect(homeAssignment(empty, null).button).toBe("Explore Programs");
  });
  it("offers setup for an owned program that has not started", () => {
    const card = homeAssignment(
      {
        ...empty,
        accelerator: {
          entitlementId: "purchase",
          status: "not_started",
          currentRun: null,
          previousRuns: [],
        },
      },
      null,
    );
    expect(card.title).toContain("ready");
    expect(card.button).toBe("Start Your Program");
  });
  it("keeps completed history distinct from paused and active work", () => {
    const card = homeAssignment(
      {
        ...empty,
        leadPlans: [{ leadPlanId: "plan", status: "completed", completedDays: 7, totalDays: 7 }],
      },
      null,
    );
    expect(card.title).toContain("completed");
    expect(card.button).toBe("View Your Programs");
  });
  it("does not invent a workout when an active program's detail request fails", () => {
    const card = homeAssignment({ ...empty, activeProgram: "accelerator" }, null);
    expect(card.description).toContain("unavailable");
    expect(card.to).toBe("/my-programs");
  });
});
