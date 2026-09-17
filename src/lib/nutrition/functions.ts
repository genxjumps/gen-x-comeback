import { createServerFn } from "@tanstack/react-start";

import { calculateNutritionTargets, normalizeMealPercentages } from "@/lib/nutrition/calculator";
import {
  nutritionAccountInputSchema,
  nutritionIntakeSchema,
  nutritionProfileSchema,
  saveNutritionProfileInputSchema,
} from "@/lib/nutrition/schemas";
import {
  NUTRITION_FORMULA_VERSION,
  type NutritionProfile,
  type NutritionProfileResult,
  type SaveNutritionProfileResult,
  type SavedWeightPrefill,
} from "@/lib/nutrition/types";
import { buildNutritionTargetReview } from "@/lib/nutrition/target-review";

type StoreError = { message: string } | null;
export type NutritionProfileRow = {
  formula_version: string;
  input_payload: unknown;
  maintenance_calories: number;
  target_payload: unknown;
  meal_slider_positions: unknown;
  calculated_at: string;
};
type NutritionSelectResult = { data: NutritionProfileRow[] | null; error: StoreError };
type NutritionWriteResult = { error: StoreError };
type NutritionStoreQuery = {
  select(columns: string): NutritionStoreQuery;
  eq(column: string, value: string): NutritionStoreQuery;
  limit(count: number): PromiseLike<NutritionSelectResult>;
  upsert(
    values: Record<string, unknown>,
    options: { onConflict: string },
  ): PromiseLike<NutritionWriteResult>;
};
export type NutritionStoreClient = {
  from(table: "customer_nutrition_profiles"): NutritionStoreQuery;
};

async function authorize() {
  const { currentAuthorizationHeader } = await import("@/lib/account/customer-account.server");
  const { resolveNutritionAccess } = await import("@/lib/nutrition/access.server");
  return resolveNutritionAccess(await currentAuthorizationHeader());
}

function storedProfile(row: NutritionProfileRow): NutritionProfile {
  const intake = nutritionIntakeSchema.parse(row.input_payload);
  return nutritionProfileSchema.parse({
    formulaVersion: row.formula_version,
    intake,
    maintenanceCalories: row.maintenance_calories,
    targets: row.target_payload,
    mealPercentages: normalizeMealPercentages(
      intake,
      row.meal_slider_positions as Record<string, number>,
    ),
    // Postgres serializes timestamptz values with an explicit offset, while the
    // profile contract keeps browser-facing timestamps in canonical UTC form.
    calculatedAt: new Date(row.calculated_at).toISOString(),
  });
}

async function loadSavedWeight(customerId: string): Promise<SavedWeightPrefill> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("customer_measurements")
    .select("value, unit")
    .eq("customer_id", customerId)
    .eq("measurement_kind", "weight")
    .eq("status", "active")
    .order("measured_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row && (row.unit === "lb" || row.unit === "kg")
    ? { value: Number(row.value), unit: row.unit }
    : null;
}

export const getNutritionProfile = createServerFn({ method: "POST" })
  .validator((data: unknown) => nutritionAccountInputSchema.parse(data))
  .handler(async (): Promise<NutritionProfileResult> => {
    const access = await authorize();
    if (!access) return { ok: false };
    if (!access.eligible) return { ok: true, access: "locked" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const store = supabaseAdmin as unknown as NutritionStoreClient;
    const [profileResult, savedWeight] = await Promise.all([
      store
        .from("customer_nutrition_profiles")
        .select(
          "formula_version, input_payload, maintenance_calories, target_payload, meal_slider_positions, calculated_at",
        )
        .eq("customer_id", access.customerAccountId)
        .limit(1),
      loadSavedWeight(access.customerAccountId),
    ]);
    if (profileResult.error) throw new Error(profileResult.error.message);

    const profile = profileResult.data?.[0] ? storedProfile(profileResult.data[0]) : null;
    return {
      ok: true,
      access: "eligible",
      profile,
      savedWeight,
      targetReview: profile
        ? buildNutritionTargetReview({
            intake: profile.intake,
            targets: profile.targets,
            savedWeight,
          })
        : null,
    };
  });

export const saveNutritionProfile = createServerFn({ method: "POST" })
  .validator((data: unknown) => saveNutritionProfileInputSchema.parse(data))
  .handler(async ({ data }): Promise<SaveNutritionProfileResult> => {
    const access = await authorize();
    if (!access) return { ok: false, reason: "unauthorized" };
    if (!access.eligible) return { ok: false, reason: "locked" };

    const calculation = calculateNutritionTargets(data.intake);
    if (!calculation.ok) return { ok: false, reason: "stopped" };

    const calculatedAt = new Date().toISOString();
    const mealPercentages = normalizeMealPercentages(data.intake, data.mealPercentages);
    const profile = nutritionProfileSchema.parse({
      formulaVersion: NUTRITION_FORMULA_VERSION,
      intake: data.intake,
      maintenanceCalories: calculation.maintenanceCalories,
      targets: calculation.targets,
      mealPercentages,
      calculatedAt,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const store = supabaseAdmin as unknown as NutritionStoreClient;
    const { error } = await store.from("customer_nutrition_profiles").upsert(
      {
        customer_id: access.customerAccountId,
        formula_version: NUTRITION_FORMULA_VERSION,
        input_payload: profile.intake,
        maintenance_calories: profile.maintenanceCalories,
        target_payload: profile.targets,
        meal_slider_positions: profile.mealPercentages,
        calculated_at: profile.calculatedAt,
        updated_at: profile.calculatedAt,
      },
      { onConflict: "customer_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, profile };
  });
