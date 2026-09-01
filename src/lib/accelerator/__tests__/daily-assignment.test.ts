import { describe, expect, it } from "vitest";

import { daysWaitingFromAvailableOn, missedDayMessage } from "../daily-assignment";

describe("daily assignment return messaging", () => {
  it("calculates missed days in the run's fixed customer time zone", () => {
    const now = new Date("2026-08-29T02:00:00Z");
    expect(daysWaitingFromAvailableOn("2026-08-27", true, "America/New_York", now)).toBe(1);
    expect(daysWaitingFromAvailableOn("2026-08-27", true, "UTC", now)).toBe(2);
  });

  it("does not call a customer behind or stack missed assignments", () => {
    expect(missedDayMessage(0)).toBeNull();
    expect(missedDayMessage(1)).toContain("haven't lost your place");
    expect(missedDayMessage(2)).toContain("no doubled workout");
    expect(missedDayMessage(4)).toContain("missing-person report");
  });
});
