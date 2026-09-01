import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const assignment = readSource("../../../components/accelerator-program.tsx");
const content = readSource("../content.ts");
const functions = readSource("../functions.ts");
const videoTracker = readSource("../../../components/accelerator-video-tracker.tsx");

describe("customer-facing Daily Assignment contract", () => {
  it("shows the required assignment information without adding a survey or workout log", () => {
    expect(assignment).toContain("Today's focus");
    expect(assignment).toContain("Practical instructions");
    expect(assignment).toContain("Equipment");
    expect(assignment).toContain("runtimeSeconds");
    expect(assignment).toContain("Complete Day");
    expect(assignment).not.toMatch(/rating|modification category|workout log|post-workout survey/i);
  });

  it("uses verified Cloudflare media for A-E while keeping unfinished media honest", () => {
    expect(content).toContain("767c2265f63d67fb5dc3b1c5f3a3e44e");
    expect(content).toContain("a863bce8634666b5766ff277685b6b83");
    expect(content).toContain("bce4346d2ec59177ed09934e26512bb8");
    expect(content).toContain("b0a32ba5f5f64fb2e8d5829cde007656");
    expect(content).toContain("9b80d965a884486cf5e38b26d1ff671f");
    expect(content).toContain('readiness: "pending_recording"');
    expect(assignment).toContain("<AcceleratorVideoTracker");
    expect(assignment).toContain("Cloudflare Stream video pending");
    expect(videoTracker).toContain('addEventListener("play"');
  });

  it("supports canonical recovery guidance, rest, completion, brief Undo, and a path Home", () => {
    expect(content).toContain("Use the Active Recovery session if it helps");
    expect(assignment).toContain("Take the full recovery day");
    expect(assignment).toContain("Day {justCompletedDay} Complete");
    expect(assignment).toContain('to="/home"');
    expect(assignment).toContain("undoAcceleratorDay");
    expect(assignment).toContain("canUndo");
  });

  it("binds completion, Undo, and video views to the run loaded on-screen", () => {
    expect(assignment).toContain("enrollmentId: loadedHub.enrollmentId");
    expect(videoTracker).toContain("enrollmentId");
    expect(functions).toContain("access.enrollmentId !== data.enrollmentId");
  });

  it("reopens completed days and exposes locked days only as previews", () => {
    expect(assignment).toContain("Completed - open again");
    expect(assignment).toContain("Locked preview");
    expect(assignment).toContain("Video unlocks with this assignment");
    expect(assignment).toContain("openScheduleDay");
  });

  it("distinguishes paused and customer-local waiting states", () => {
    expect(functions).toContain("customer_time_zone");
    expect(functions).toContain("daysWaitingFromAvailableOn");
    expect(assignment).toContain("This run is paused");
    expect(assignment).toContain("friendlyDate(hub.progress.availableOn)");
  });
});
