import { describe, expect, it } from "vitest";

import {
  ACCELERATOR_ASSIGNMENT_CONTENT,
  ACCELERATOR_ORIENTATION,
  ACCELERATOR_WEEKLY_COACHING,
} from "../content";
import { buildAcceleratorProgramSnapshot } from "../program";

describe("28-Day Accelerator content readiness", () => {
  it("stores the approved orientation and four weekly coaching messages", () => {
    expect(ACCELERATOR_ORIENTATION.title).toBe("Welcome to the 28-Day Fat Loss Accelerator");
    expect(ACCELERATOR_ORIENTATION.writtenExplanation.length).toBeGreaterThan(0);
    expect(ACCELERATOR_WEEKLY_COACHING.map(({ title }) => title)).toEqual([
      "Set Your Baseline",
      "Clean It Up",
      "Raise Your Output",
      "Finish Strong",
    ]);
  });

  it("stores the verified Cloudflare media for completed Workouts A-E", () => {
    expect(ACCELERATOR_ASSIGNMENT_CONTENT.workout_a.media).toEqual({
      readiness: "uploaded",
      cloudflareStreamUid: "767c2265f63d67fb5dc3b1c5f3a3e44e",
      runtimeSeconds: 1543,
    });
    expect(ACCELERATOR_ASSIGNMENT_CONTENT.workout_b.media).toEqual({
      readiness: "uploaded",
      cloudflareStreamUid: "a863bce8634666b5766ff277685b6b83",
      runtimeSeconds: 1650,
    });
    expect(ACCELERATOR_ASSIGNMENT_CONTENT.workout_c.media).toEqual({
      readiness: "uploaded",
      cloudflareStreamUid: "bce4346d2ec59177ed09934e26512bb8",
      runtimeSeconds: 1447,
    });
    expect(ACCELERATOR_ASSIGNMENT_CONTENT.workout_d.media).toEqual({
      readiness: "uploaded",
      cloudflareStreamUid: "b0a32ba5f5f64fb2e8d5829cde007656",
      runtimeSeconds: 1584,
    });
    expect(ACCELERATOR_ASSIGNMENT_CONTENT.workout_e.media).toEqual({
      readiness: "uploaded",
      cloudflareStreamUid: "9b80d965a884486cf5e38b26d1ff671f",
      runtimeSeconds: 1507,
    });
  });

  it("keeps Workout F and coaching media visibly pending recording", () => {
    expect(ACCELERATOR_ASSIGNMENT_CONTENT.active_recovery_f.media?.readiness).toBe(
      "pending_recording",
    );
    expect(ACCELERATOR_ORIENTATION.media.readiness).toBe("pending_recording");
    expect(
      ACCELERATOR_WEEKLY_COACHING.every(({ media }) => media.readiness === "pending_recording"),
    ).toBe(true);
  });

  it("keeps rest as a non-video assignment", () => {
    expect(ACCELERATOR_ASSIGNMENT_CONTENT.rest.media).toBeNull();
  });

  it("persists content with the versioned enrollment snapshot", () => {
    const snapshot = buildAcceleratorProgramSnapshot();

    expect(snapshot.orientation.title).toBe(ACCELERATOR_ORIENTATION.title);
    expect(snapshot.weeklyCoaching).toHaveLength(4);
    expect(snapshot.assignmentContent.workout_a.instructions).toContain("Complete Workout A");
    expect(snapshot.assignmentContent.workout_a.media.cloudflareStreamUid).toBe(
      "767c2265f63d67fb5dc3b1c5f3a3e44e",
    );
    expect(snapshot.assignmentContent.active_recovery_f.media?.cloudflareStreamUid).toBeNull();
  });
});
