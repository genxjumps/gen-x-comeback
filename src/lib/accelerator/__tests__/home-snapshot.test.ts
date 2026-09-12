import { describe, expect, it } from "vitest";
import { homeAssignment } from "../home-snapshot";
import { buildAcceleratorProgramSnapshot } from "../program";
import type { AcceleratorHubData, MyProgramsResult } from "../types";

const empty: Extract<MyProgramsResult, { ok: true }> = {
  ok: true,
  firstName: "Test",
  accelerator: null,
  leadPlans: [],
  activeProgram: null,
  latestMeasurements: { weight: null, waist: null },
};

const activeAccelerator: Extract<MyProgramsResult, { ok: true }> = {
  ...empty,
  accelerator: {
    entitlementId: "purchase",
    status: "active",
    currentRun: null,
    previousRuns: [],
  },
  activeProgram: "accelerator",
};

function acceleratorHub(
  day: number | null,
  options: { waiting?: boolean; completed?: boolean } = {},
): AcceleratorHubData {
  const snapshot = buildAcceleratorProgramSnapshot();
  const completedDays = day ? Array.from({ length: day - 1 }, (_, index) => index + 1) : [];
  const emptyMeasurements = { weight: null, waist: null };

  return {
    firstName: "Test",
    entitlementId: "purchase",
    enrollmentId: "run",
    programVersion: snapshot.programVersion,
    runStatus: options.completed ? "completed" : "active",
    snapshot,
    completedDays,
    progress: {
      currentDay: day,
      availableOn: options.waiting ? "2026-09-13" : null,
      canCompleteCurrent: !options.waiting,
      undoDay: null,
      undoUntil: null,
      programCompleted: Boolean(options.completed),
      daysWaiting: options.waiting ? 1 : 0,
    },
    measurements: [],
    measurementSummary: {
      globalLatest: emptyMeasurements,
      runStarting: emptyMeasurements,
      runNewest: emptyMeasurements,
      runFinal: emptyMeasurements,
    },
  };
}

describe("homepage next step", () => {
  it("uses a minimal loading state", () => {
    expect(homeAssignment(null, null)).toMatchObject({
      label: "",
      title: "Loading...",
      description: "",
    });
  });

  it("keeps an unavailable account distinct from an account without programs", () => {
    expect(homeAssignment({ ok: false }, null)).toMatchObject({
      label: "Your Next Step",
      title: "Find your next workout in Programs",
      description: "",
      button: "Open Programs",
    });
    expect(homeAssignment(empty, null)).toMatchObject({
      title: "Choose your first program",
      description: "",
      to: "/my-programs",
      button: "View Programs",
    });
  });

  it("shows paused progress without repeating persistence instructions", () => {
    const card = homeAssignment(
      {
        ...empty,
        leadPlans: [{ leadPlanId: "plan", status: "paused", completedDays: 3, totalDays: 7 }],
      },
      null,
    );
    expect(card).toMatchObject({
      label: "Ready When You Are",
      title: "Resume 7-Day Comeback Plan",
      description: "You’ve completed 3 of 7 days.",
      button: "Open Programs",
    });
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
    expect(card).toMatchObject({
      title: "Start the 28-Day Fat Loss Accelerator",
      description: "Set it up, then begin Day 1.",
      button: "Set Up My Accelerator",
    });
  });

  it("keeps completed history distinct from paused and active work", () => {
    const card = homeAssignment(
      {
        ...empty,
        leadPlans: [{ leadPlanId: "plan", status: "completed", completedDays: 7, totalDays: 7 }],
      },
      null,
    );
    expect(card).toMatchObject({
      label: "What’s Next",
      title: "Choose what’s next",
      description: "Review a completed program or start another.",
      button: "View Programs",
    });
  });

  it("uses a neutral action if an active program's detail request is unresolved", () => {
    expect(homeAssignment(activeAccelerator, null)).toMatchObject({
      label: "Your Current Program",
      title: "Continue your current program",
      description: "",
      to: "/my-programs",
      button: "Open Programs",
    });
  });

  it("labels an active Accelerator workout", () => {
    expect(homeAssignment(activeAccelerator, acceleratorHub(1))).toMatchObject({
      label: "Today’s Workout",
      title: "Day 1: Workout A - Classic Intervals",
      description: "Week 1 - 0 of 28 days complete",
      button: "Open Today’s Workout",
      to: "/accelerator",
    });
  });

  it("distinguishes active recovery and rest from workouts", () => {
    expect(homeAssignment(activeAccelerator, acceleratorHub(6))).toMatchObject({
      label: "Today’s Recovery",
      title: "Day 6: Workout F - Active Recovery",
      button: "Open Today’s Recovery",
    });
    expect(homeAssignment(activeAccelerator, acceleratorHub(7))).toMatchObject({
      label: "Today’s Rest Day",
      title: "Day 7: Rest Day",
      button: "Open Rest Day",
    });
  });

  it("makes clear when today's work is complete", () => {
    expect(homeAssignment(activeAccelerator, acceleratorHub(2, { waiting: true }))).toMatchObject({
      label: "Today Complete",
      title: "You’re done for today",
      description: "Day 2 - Workout B - EMOM - opens September 13.",
      button: "Preview Next Day",
    });
  });

  it("points a completed Accelerator to its results", () => {
    expect(
      homeAssignment(activeAccelerator, acceleratorHub(null, { completed: true })),
    ).toMatchObject({
      label: "Program Complete",
      title: "You completed the 28-Day Accelerator",
      description: "See your final progress and choose what’s next.",
      button: "View My Results",
    });
  });

  it("shows the next 7-Day plan day without repeated save language", () => {
    const card = homeAssignment(
      {
        ...empty,
        leadPlans: [{ leadPlanId: "plan", status: "active", completedDays: 2, totalDays: 7 }],
        activeProgram: "lead_plan",
      },
      null,
    );
    expect(card).toMatchObject({
      label: "Your Next Day",
      title: "Day 3: 7-Day Comeback Plan",
      description: "2 of 7 days complete",
      button: "Open My Plan",
    });
  });
});
