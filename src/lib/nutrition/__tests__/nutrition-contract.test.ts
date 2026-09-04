import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Your Nutrition V1 contract", () => {
  it("stores one account-owned versioned profile without connecting it to a program run", () => {
    const migration = readSource(
      "../../../../supabase/migrations/20260904140000_customer_nutrition_profiles.sql",
    );
    expect(migration).toContain("customer_id uuid PRIMARY KEY REFERENCES public.customer_accounts");
    expect(migration).toContain("formula_version text NOT NULL");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE");
    expect(migration).toContain("REVOKE DELETE");
    expect(migration).not.toMatch(/enrollment_id|email|stripe/i);
  });

  it("recalculates targets on the server and never trusts client-provided target numbers", () => {
    const functions = readSource("../functions.ts");
    expect(functions).toContain("calculateNutritionTargets(data.intake)");
    expect(functions).toContain("normalizeSliderPositions(data.intake, data.sliderPositions)");
    expect(functions).toContain("customer_nutrition_profiles");
    expect(functions).not.toContain("data.targets");
  });

  it("keeps the free plan locked and the nutrition tool separate from workout progress", () => {
    const access = readSource("../access.server.ts");
    const route = readSource("../../../routes/nutrition.tsx");
    expect(access).toContain('NUTRITION_ELIGIBLE_PRODUCT_CODES = ["accelerator_28"]');
    expect(access).not.toContain("paid_program_enrollments");
    expect(route).toContain("The free 7-Day Comeback Plan does not unlock the nutrition tool");
    expect(route).not.toMatch(/completeAcceleratorDay|beginAccelerator|activateLeadPlan/);
  });

  it("contains the approved direct guidance without adding an intake audit or food log", () => {
    const route = readSource("../../../routes/nutrition.tsx");
    expect(route).toContain("Calories Matter. Protein First. Meals Stay Simple.");
    expect(route).toContain("You messed up a meal. Fine.");
    expect(route).toContain("This app cannot verify what you ate.");
    expect(route).toContain("No food logging required.");
    expect(route).not.toMatch(/adherence score|temporary calorie log|barcode/i);
  });
});
