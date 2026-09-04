import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const workout = readSource("../../../components/accelerator-program.tsx");
const acceleratorRoute = readSource("../../../routes/accelerator.tsx");
const content = readSource("../content.ts");
const functions = readSource("../functions.ts");
const videoTracker = readSource("../../../components/accelerator-video-tracker.tsx");

describe("customer-facing daily workout contract", () => {
  it("shows the required workout information without adding a survey or workout log", () => {
    expect(workout).toContain("Today's focus");
    expect(workout).toContain("Practical instructions");
    expect(workout).toContain("Equipment");
    expect(workout).toContain("runtimeSeconds");
    expect(workout).toContain("Complete Day");
    expect(workout).not.toMatch(/rating|modification category|workout log|post-workout survey/i);
  });

  it("uses verified Cloudflare media for A-E while keeping unfinished media honest", () => {
    expect(content).toContain("767c2265f63d67fb5dc3b1c5f3a3e44e");
    expect(content).toContain("a863bce8634666b5766ff277685b6b83");
    expect(content).toContain("bce4346d2ec59177ed09934e26512bb8");
    expect(content).toContain("b0a32ba5f5f64fb2e8d5829cde007656");
    expect(content).toContain("9b80d965a884486cf5e38b26d1ff671f");
    expect(content).toContain('readiness: "pending_recording"');
    expect(acceleratorRoute).toContain("<AcceleratorVideoTracker />");
    expect(workout).toContain("Cloudflare Stream video pending");
    expect(videoTracker).toContain('addEventListener("play"');
    expect(videoTracker).toContain('removeEventListener("play"');
    expect(videoTracker).toContain("observer.disconnect()");
  });

  it("supports canonical recovery guidance, rest, completion, brief Undo, and a path Home", () => {
    expect(content).toContain("Use the Active Recovery session if it helps");
    expect(workout).toContain("Take the full recovery day");
    expect(workout).toContain("Day {justCompletedDay} Complete");
    expect(workout).toContain('to="/home"');
    expect(workout).toContain("undoAcceleratorDay");
    expect(workout).toContain("canUndo");
  });

  it("binds completion, Undo, and video views to the run loaded on-screen", () => {
    expect(workout).toContain("enrollmentId: loadedHub.enrollmentId");
    expect(videoTracker).toContain("enrollmentId");
    expect(functions).toContain("access.enrollmentId !== data.enrollmentId");
  });

  it("reopens completed days and exposes locked days only as previews", () => {
    expect(workout).toContain("Completed - open again");
    expect(workout).toContain("Locked preview");
    expect(workout).toContain("Video unlocks with this workout");
    expect(workout).toContain("openScheduleDay");
  });

  it("distinguishes paused and customer-local waiting states", () => {
    expect(functions).toContain("customer_time_zone");
    expect(functions).toContain("daysWaitingFromAvailableOn");
    expect(workout).toContain("This run is paused");
    expect(workout).toContain("friendlyDate(hub.progress.availableOn)");
  });
});
