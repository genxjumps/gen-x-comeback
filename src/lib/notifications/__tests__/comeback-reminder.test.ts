import { describe, expect, it } from "vitest";

import { buildComebackReminder, type ComebackReminderInput } from "../comeback-reminder";

const ANCHOR = "2026-09-01T12:00:00Z";

function input(overrides: Partial<ComebackReminderInput> = {}): ComebackReminderInput {
  return {
    programStatus: "active",
    programRemindersEnabled: true,
    activityAnchorAt: ANCHOR,
    now: "2026-09-05T12:00:00Z",
    ...overrides,
  };
}

describe("platform comeback reminder", () => {
  it("becomes eligible at four elapsed days, not on calendar midnight", () => {
    expect(buildComebackReminder(input({ now: "2026-09-05T11:59:59Z" }))).toBeNull();
    expect(buildComebackReminder(input())).toEqual({
      code: "comeback_4_days",
      title: "Your next workout is waiting",
      message:
        "You don’t need to make up anything. Open the app, do today’s workout, and keep moving.",
    });
  });

  it("uses the ten-day message after ten elapsed days", () => {
    expect(buildComebackReminder(input({ now: "2026-09-11T12:00:00Z" }))).toMatchObject({
      code: "comeback_10_days",
      title: "Your program’s still here",
    });
  });

  it("never treats app opens as activity", () => {
    expect(buildComebackReminder(input({ now: "2026-09-07T12:00:00Z" }))).toMatchObject({
      code: "comeback_4_days",
    });
  });

  it("does not remind inactive, finished, revoked, or opted-out customers", () => {
    for (const programStatus of ["not_started", "paused", "completed", "revoked"] as const) {
      expect(buildComebackReminder(input({ programStatus }))).toBeNull();
    }
    expect(buildComebackReminder(input({ programRemindersEnabled: false }))).toBeNull();
    expect(buildComebackReminder(input({ activityAnchorAt: null }))).toBeNull();
  });

  it("starts a fresh sequence from a later completed workout or resume", () => {
    expect(
      buildComebackReminder(
        input({ activityAnchorAt: "2026-09-08T12:00:00Z", now: "2026-09-11T12:00:00Z" }),
      ),
    ).toBeNull();
    expect(
      buildComebackReminder(
        input({ activityAnchorAt: "2026-09-08T12:00:00Z", now: "2026-09-12T12:00:00Z" }),
      ),
    ).toMatchObject({ code: "comeback_4_days" });
  });
});
