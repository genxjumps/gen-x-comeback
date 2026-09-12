import { calculateNutritionTargets } from "@/lib/nutrition/calculator";
import type {
  NutritionIntake,
  NutritionTargetReview,
  NutritionTargets,
  SavedWeightPrefill,
} from "@/lib/nutrition/types";

const POUNDS_PER_KILOGRAM = 2.2046226218;
const MINIMUM_WEIGHT_CHANGE_POUNDS = 5;

function pounds(value: number, unit: "lb" | "kg"): number {
  return unit === "lb" ? value : value * POUNDS_PER_KILOGRAM;
}

function convertWeight(value: number, from: "lb" | "kg", to: "lb" | "kg"): number {
  if (from === to) return value;
  return to === "lb" ? value * POUNDS_PER_KILOGRAM : value / POUNDS_PER_KILOGRAM;
}

function targetsChanged(current: NutritionTargets, proposed: NutritionTargets): boolean {
  return (
    current.calories !== proposed.calories ||
    current.proteinGrams !== proposed.proteinGrams ||
    current.carbohydrateGrams !== proposed.carbohydrateGrams ||
    current.fatGrams !== proposed.fatGrams
  );
}

export function buildNutritionTargetReview(input: {
  intake: NutritionIntake;
  targets: NutritionTargets;
  savedWeight: SavedWeightPrefill;
}): NutritionTargetReview | null {
  if (!input.savedWeight) return null;
  if (!Number.isFinite(input.savedWeight.value) || input.savedWeight.value <= 0) return null;

  const changePounds = Math.abs(
    pounds(input.savedWeight.value, input.savedWeight.unit) -
      pounds(input.intake.currentWeight, input.intake.weightUnit),
  );
  if (changePounds < MINIMUM_WEIGHT_CHANGE_POUNDS) return null;

  const currentWeight = convertWeight(
    input.savedWeight.value,
    input.savedWeight.unit,
    input.intake.weightUnit,
  );
  const calculation = calculateNutritionTargets({ ...input.intake, currentWeight });
  if (!calculation.ok || !targetsChanged(input.targets, calculation.targets)) return null;

  return {
    measuredWeight: input.savedWeight,
    currentWeight,
    currentTargets: input.targets,
    proposedTargets: calculation.targets,
  };
}
