import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { beginAcceleratorInputSchema } from "../schemas";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("My Programs and setup contract", () => {
  it("keeps the Accelerator query scoped to its product", () => {
    const functions = readSource("../functions.ts");
    expect(functions).toContain('.eq("product_code", "accelerator_28")');
    expect(functions).toContain("runIds.includes(active.paid_enrollment_id)");
  });

  it("starts the run and optional measurements through one database transaction", () => {
    const functions = readSource("../functions.ts");
    const migration = readSource(
      "../../../../supabase/migrations/20260828180000_accelerator_enrollment_progress.sql",
    );
    const beginHandler = functions.slice(
      functions.indexOf("export const beginAccelerator"),
      functions.indexOf("export const pauseAccelerator"),
    );
    const beginFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.begin_accelerator_run_atomic"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.correct_customer_measurement_atomic"),
    );

    expect(beginHandler).toContain('rpc("begin_accelerator_run_atomic"');
    expect(beginHandler).not.toContain('rpc("add_customer_measurement_atomic"');
    expect(beginFunction).toContain("FROM public.start_program_run_atomic");
    expect(beginFunction).toContain("FROM public.add_customer_measurement_atomic");
    expect(beginFunction).toContain("p_weight_unit IS NULL");
    expect(beginFunction).toContain("p_waist_unit IS NULL");
    expect(beginFunction).toContain("RAISE EXCEPTION 'Starting weight was not saved'");
    expect(beginFunction).toContain("RAISE EXCEPTION 'Starting waist was not saved'");
  });

  it("rejects mismatched setup measurement units before reaching the database", () => {
    const base = {
      entitlementId: "00000000-0000-4000-8000-000000000001",
      customerTimeZone: "America/New_York",
      weight: null,
      waist: null,
    };
    expect(
      beginAcceleratorInputSchema.safeParse({ ...base, weight: { value: 180, unit: "in" } })
        .success,
    ).toBe(false);
    expect(
      beginAcceleratorInputSchema.safeParse({ ...base, waist: { value: 36, unit: "lb" } }).success,
    ).toBe(false);
    expect(
      beginAcceleratorInputSchema.safeParse({
        ...base,
        weight: { value: 180, unit: "lb" },
        waist: { value: 36, unit: "in" },
      }).success,
    ).toBe(true);
  });

  it("provides pause, warned resume, setup switching notice, and previous runs", () => {
    const programs = readSource("../../../routes/my-programs.tsx");
    const setup = readSource("../../../routes/my-programs.accelerator.setup.tsx");
    const previousRuns = readSource("../../../routes/my-programs.accelerator.runs.tsx");

    expect(programs).toContain("Pause Program");
    expect(programs).toContain("If another structured program is active, it will be paused");
    expect(programs).toContain('to="/my-programs/accelerator/runs"');
    expect(setup).toContain("Starting this program will pause your current structured program");
    expect(previousRuns).toContain("Previous Accelerator Runs");
    expect(previousRuns).toContain("run.programVersion");
  });

  it("lets a repeat run reuse, change, or skip current measurements", () => {
    const functions = readSource("../functions.ts");
    const setup = readSource("../../../routes/my-programs.accelerator.setup.tsx");

    expect(functions).toContain("latestMeasurementPair");
    expect(functions).toContain("latestMeasurements,");
    expect(setup).toContain("Use your current measurements as the starting point for this run?");
    expect(setup).toContain("Use Current Measurements");
    expect(setup).toContain("Skip Measurements");
    expect(setup).toContain("You can change or clear either number below before starting");
    expect(setup).toContain("unit: weightUnit");
    expect(setup).toContain("unit: waistUnit");
  });
});
