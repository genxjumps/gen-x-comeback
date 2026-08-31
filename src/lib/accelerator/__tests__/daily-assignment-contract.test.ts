import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const assignment = readSource("../../../components/accelerator-program.tsx");
const program = readSource("../program.ts");
const functions = readSource("../functions.ts");

describe("customer-facing Daily Assignment contract", () => {
  it("shows the required assignment information without adding a survey or workout log", () => {
    expect(assignment).toContain("Today's focus");
    expect(assignment).toContain("Practical instructions");
    expect(assignment).toContain("Equipment");
    expect(assignment).toContain("runtimeLabel");
    expect(assignment).toContain("Complete Day");
    expect(assignment).not.toMatch(/rating|modification category|workout log|post-workout survey/i);
  });

  it("keeps media placeholders honest and ready for final Stream identifiers", () => {
    expect(program).toContain("mediaKey: null");
    expect(program).toContain("Final runtime pending media verification");
    expect(assignment).toContain("Cloudflare Stream ID pending");
    expect(assignment).toContain("data-media-key");
    expect(assignment).not.toContain("<iframe");
  });

  it("supports recovery, rest, completion, brief Undo, and a path Home", () => {
    expect(program).toContain("Keep the effort easy enough to speak in full sentences");
    expect(program).toContain("Take the full recovery day");
    expect(assignment).toContain("Day {justCompletedDay} Complete");
    expect(assignment).toContain('to="/home"');
    expect(assignment).toContain("undoAcceleratorDay");
    expect(assignment).toContain("canUndo");
  });

  it("binds completion, Undo, and future video views to the run loaded on-screen", () => {
    expect(assignment).toContain("enrollmentId: loadedHub.enrollmentId");
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
