import { describe, expect, it } from "vitest";

import {
  buildAdminCustomerProgress,
  sortAdminCustomerProgress,
  type AdminCompletion,
  type AdminEnrollment,
} from "@/lib/admin/customer-progress";
import type { CustomerMeasurement } from "@/lib/accelerator/types";

const NOW = new Date("2026-09-04T12:00:00.000Z");

function enrollment(overrides: Partial<AdminEnrollment> = {}): AdminEnrollment {
  return {
    id: "run-1",
    runNumber: 1,
    status: "active",
    startedAt: "2026-08-28T12:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function completion(overrides: Partial<AdminCompletion> = {}): AdminCompletion {
  return {
    enrollmentId: "run-1",
    dayNumber: 1,
    completedAt: "2026-08-29T12:00:00.000Z",
    ...overrides,
  };
}

function measurement(overrides: Partial<CustomerMeasurement> = {}): CustomerMeasurement {
  return {
    id: "measurement-1",
    enrollmentId: "run-1",
    kind: "weight",
    value: 200,
    unit: "lb",
    context: "starting",
    notes: null,
    measuredAt: "2026-08-28T12:00:00.000Z",
    createdAt: "2026-08-28T12:00:00.000Z",
    ...overrides,
  };
}

describe("private customer progress summary", () => {
  it("shows an owned Accelerator with no run as enrolled but not started", () => {
    const result = buildAdminCustomerProgress({
      customerId: "customer-1",
      firstName: "Todd",
      enrolledAt: "2026-09-01T12:00:00.000Z",
      enrollments: [],
      completions: [],
      measurements: [],
      now: NOW,
    });

    expect(result.status).toBe("not_started");
    expect(result.currentDay).toBeNull();
    expect(result.runNumber).toBeNull();
    expect(result.lastCompletedAt).toBeNull();
  });

  it("uses the active run, shows the next day, and flags four inactive days", () => {
    const result = buildAdminCustomerProgress({
      customerId: "customer-1",
      firstName: "Todd",
      enrolledAt: "2026-08-20T12:00:00.000Z",
      enrollments: [
        enrollment({
          id: "completed-run",
          runNumber: 1,
          status: "completed",
          completedAt: "2026-08-25T12:00:00.000Z",
        }),
        enrollment({ id: "active-run", runNumber: 2, startedAt: "2026-08-27T12:00:00.000Z" }),
      ],
      completions: [
        completion({
          enrollmentId: "active-run",
          dayNumber: 1,
          completedAt: "2026-08-30T12:00:00.000Z",
        }),
        completion({
          enrollmentId: "active-run",
          dayNumber: 2,
          completedAt: "2026-08-31T12:00:00.000Z",
        }),
      ],
      measurements: [],
      now: NOW,
    });

    expect(result.status).toBe("active");
    expect(result.runNumber).toBe(2);
    expect(result.currentDay).toBe(3);
    expect(result.completedDays).toBe(2);
    expect(result.lastCompletedDay).toBe(2);
    expect(result.inactiveDays).toBe(4);
  });

  it("keeps paused and completed runs out of the inactive filter state", () => {
    const paused = buildAdminCustomerProgress({
      customerId: "customer-1",
      firstName: "Todd",
      enrolledAt: "2026-08-20T12:00:00.000Z",
      enrollments: [enrollment({ status: "paused", pausedAt: "2026-08-28T12:00:00.000Z" })],
      completions: [],
      measurements: [],
      now: NOW,
    });
    const completed = buildAdminCustomerProgress({
      customerId: "customer-2",
      firstName: "Sam",
      enrolledAt: "2026-08-20T12:00:00.000Z",
      enrollments: [enrollment({ status: "completed", completedAt: "2026-08-28T12:00:00.000Z" })],
      completions: [completion({ dayNumber: 28 })],
      measurements: [],
      now: NOW,
    });

    expect(paused.inactiveDays).toBeNull();
    expect(completed.inactiveDays).toBeNull();
    expect(completed.currentDay).toBeNull();
  });

  it("keeps the approved starting, latest, and final measurement views distinct", () => {
    const result = buildAdminCustomerProgress({
      customerId: "customer-1",
      firstName: "Todd",
      enrolledAt: "2026-08-20T12:00:00.000Z",
      enrollments: [enrollment()],
      completions: [],
      measurements: [
        measurement(),
        measurement({
          id: "measurement-2",
          value: 195,
          context: "progress",
          measuredAt: "2026-09-02T12:00:00.000Z",
          createdAt: "2026-09-02T12:00:00.000Z",
        }),
        measurement({
          id: "measurement-3",
          value: 190,
          context: "final",
          measuredAt: "2026-09-03T12:00:00.000Z",
          createdAt: "2026-09-03T12:00:00.000Z",
        }),
      ],
      now: NOW,
    });

    expect(result.measurements.starting.weight?.value).toBe(200);
    expect(result.measurements.latest.weight?.value).toBe(190);
    expect(result.measurements.final.weight?.value).toBe(190);
  });

  it("sorts the most recently active customer first", () => {
    const older = buildAdminCustomerProgress({
      customerId: "customer-1",
      firstName: "Amy",
      enrolledAt: "2026-08-20T12:00:00.000Z",
      enrollments: [enrollment({ startedAt: "2026-08-22T12:00:00.000Z" })],
      completions: [],
      measurements: [],
      now: NOW,
    });
    const newer = buildAdminCustomerProgress({
      customerId: "customer-2",
      firstName: "Bri",
      enrolledAt: "2026-08-20T12:00:00.000Z",
      enrollments: [enrollment({ id: "run-2", startedAt: "2026-09-03T12:00:00.000Z" })],
      completions: [],
      measurements: [],
      now: NOW,
    });

    expect(
      sortAdminCustomerProgress([older, newer]).map((customer) => customer.customerId),
    ).toEqual(["customer-2", "customer-1"]);
  });
});
