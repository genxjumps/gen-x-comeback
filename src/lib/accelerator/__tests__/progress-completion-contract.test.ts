import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const progress = readSource("../../../routes/progress.tsx");
const completion = readSource("../../../components/accelerator-completion.tsx");
const previousRuns = readSource("../../../routes/my-programs_.accelerator.runs.tsx");
const functions = readSource("../functions.ts");

describe("customer progress and Day 28 completion contract", () => {
  it("keeps the default progress view simple and puts history behind another action", () => {
    expect(progress).toContain("Current Program");
    expect(progress).toContain("Latest Weight");
    expect(progress).toContain("Latest Waist");
    expect(progress).toContain("View Detailed History");
    expect(progress).toContain("detailsOpen");
  });

  it("supports independent additions, corrections, and removals", () => {
    expect(progress).toContain("addAcceleratorMeasurement");
    expect(progress).toContain("correctCustomerMeasurement");
    expect(progress).toContain("removeCustomerMeasurement");
    expect(progress).toContain('saveNew("weight"');
    expect(progress).toContain('saveNew("waist"');
  });

  it("shows each previous run's boundary measurements", () => {
    expect(previousRuns).toContain("Starting weight");
    expect(previousRuns).toContain("Newest weight");
    expect(previousRuns).toContain("Starting waist");
    expect(previousRuns).toContain("Newest waist");
    expect(functions).toContain("measurementSummary(measurements, run.id)");
  });

  it("keeps completion and final measurements separate", () => {
    expect(completion).toContain("You Completed All 28 Days");
    expect(completion).toContain("Your program is already complete");
    expect(completion).toContain('context: "final"');
    expect(completion).toContain("Add either one, both, or skip them");
  });

  it("offers a real repeat path and other-program recommendations", () => {
    expect(completion).toContain("Start Another Run");
    expect(completion).toContain('to="/my-programs/accelerator/setup"');
    expect(completion).toContain("Explore Other Programs");
    expect(completion).toContain('to="/programs"');
  });
});
