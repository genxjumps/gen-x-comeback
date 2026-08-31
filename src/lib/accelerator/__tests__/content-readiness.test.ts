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

  it("marks completed A-E videos ready for Cloudflare without inventing media ids or runtimes", () => {
    for (const code of ["workout_a", "workout_b", "workout_c", "workout_d", "workout_e"] as const) {
      expect(ACCELERATOR_ASSIGNMENT_CONTENT[code].media).toEqual({
        readiness: "ready_for_cloudflare",
        cloudflareStreamUid: null,
        runtimeSeconds: null,
      });
    }
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
    expect(snapshot.assignmentContent.active_recovery_f.media?.cloudflareStreamUid).toBeNull();
  });
});
