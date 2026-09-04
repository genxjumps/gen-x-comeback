import { nutritionIntakeSchema } from "@/lib/nutrition/schemas";
import type {
  MealAllocation,
  MealOccasion,
  MealSliderPosition,
  MealSliderPositions,
  NutritionCalculation,
  NutritionIntake,
  NutritionTargets,
} from "@/lib/nutrition/types";

const POUNDS_PER_KILOGRAM = 2.2046226218;
const CENTIMETERS_PER_INCH = 2.54;

const movementMultipliers = {
  mostly_sitting: 1.25,
  on_feet: 1.4,
  physical_work: 1.55,
} as const;

function roundToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function roundUpToIncrement(value: number, increment: number): number {
  return Math.ceil(value / increment) * increment;
}

export function heightInCentimeters(input: NutritionIntake): number {
  return input.height.unit === "metric"
    ? input.height.centimeters
    : (input.height.feet * 12 + input.height.inches) * CENTIMETERS_PER_INCH;
}

function weightInPounds(weight: number, unit: "lb" | "kg"): number {
  return unit === "lb" ? weight : weight * POUNDS_PER_KILOGRAM;
}

function weightInKilograms(weight: number, unit: "lb" | "kg"): number {
  return unit === "kg" ? weight : weight / POUNDS_PER_KILOGRAM;
}

export function healthyWeightRangePounds(heightCentimeters: number): {
  minimum: number;
  maximum: number;
} {
  const meters = heightCentimeters / 100;
  return {
    minimum: 18.5 * meters * meters * POUNDS_PER_KILOGRAM,
    maximum: 24.9 * meters * meters * POUNDS_PER_KILOGRAM,
  };
}

export function calculateNutritionTargets(rawInput: NutritionIntake): NutritionCalculation {
  const input = nutritionIntakeSchema.parse(rawInput);
  const heightCentimeters = heightInCentimeters(input);
  const currentKilograms = weightInKilograms(input.currentWeight, input.weightUnit);
  const currentPounds = weightInPounds(input.currentWeight, input.weightUnit);
  const goalPounds =
    input.goalWeight === null ? null : weightInPounds(input.goalWeight, input.weightUnit);
  const healthyRange = healthyWeightRangePounds(heightCentimeters);

  if (goalPounds !== null && goalPounds < healthyRange.minimum) {
    return { ok: false, reason: "goal_below_healthy_range" };
  }

  const sexAdjustment = input.sex === "male" ? 5 : -161;
  const restingEnergy =
    10 * currentKilograms + 6.25 * heightCentimeters - 5 * input.age + sexAdjustment;
  const maintenanceCalories = roundUpToIncrement(
    restingEnergy * movementMultipliers[input.movement],
    50,
  );
  const calorieReduction = Math.min(maintenanceCalories * 0.1, 500);
  const calories =
    input.weightDirection === "lose"
      ? roundToIncrement(maintenanceCalories - calorieReduction, 50)
      : maintenanceCalories;

  if (calories < 1200) return { ok: false, reason: "calorie_floor" };

  const uncappedReferencePounds =
    input.weightDirection === "maintain" ? currentPounds : (goalPounds ?? currentPounds);
  const referencePounds = Math.min(uncappedReferencePounds, healthyRange.maximum);
  const strengthFactor = input.training === "strength" || input.training === "both" ? 1.1 : 1;
  const proteinGrams = roundToIncrement(referencePounds * strengthFactor, 5);
  const fatGrams = roundToIncrement((calories * 0.25) / 9, 5);
  const carbohydrateCalories = calories - proteinGrams * 4 - fatGrams * 9;
  if (carbohydrateCalories < 0) return { ok: false, reason: "unsuitable_macros" };
  const carbohydrateGrams = roundToIncrement(carbohydrateCalories / 4, 5);

  return {
    ok: true,
    maintenanceCalories,
    targets: { calories, proteinGrams, carbohydrateGrams, fatGrams },
  };
}

export function recommendedSliderPositions(input: NutritionIntake): MealSliderPositions {
  const selected = new Set(input.mealOccasions);
  if (input.mealOccasions.length === 1) {
    return { [input.mealOccasions[0]]: 3 };
  }

  const positions: MealSliderPositions = {};
  for (const occasion of input.mealOccasions) {
    positions[occasion] = occasion === "extras" ? 2 : 3;
  }
  if (input.biggestMeal && input.biggestMeal !== "same" && selected.has(input.biggestMeal)) {
    positions[input.biggestMeal] = 4;
  }
  return positions;
}

export function normalizeSliderPositions(
  input: NutritionIntake,
  requested: MealSliderPositions = {},
): MealSliderPositions {
  const recommended = recommendedSliderPositions(input);
  return Object.fromEntries(
    input.mealOccasions.map((occasion) => [occasion, requested[occasion] ?? recommended[occasion]]),
  ) as MealSliderPositions;
}

function allocateInteger(total: number, weights: number[]): number[] {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (total * weight) / weightTotal);
  const allocated = exact.map(Math.floor);
  let remainder = total - allocated.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  for (let index = 0; index < order.length && remainder > 0; index += 1, remainder -= 1) {
    allocated[order[index].index] += 1;
  }
  return allocated;
}

export function allocateMealTargets(
  targets: NutritionTargets,
  input: NutritionIntake,
  requestedPositions: MealSliderPositions = {},
): MealAllocation[] {
  const positions = normalizeSliderPositions(input, requestedPositions);
  const weights = input.mealOccasions.map((occasion) => positions[occasion] ?? 3);
  const percentages = allocateInteger(100, weights);
  const calories = allocateInteger(targets.calories, weights);
  const protein = allocateInteger(targets.proteinGrams, weights);
  const carbohydrates = allocateInteger(targets.carbohydrateGrams, weights);
  const fat = allocateInteger(targets.fatGrams, weights);

  return input.mealOccasions.map((occasion, index) => ({
    occasion,
    position: (positions[occasion] ?? 3) as MealSliderPosition,
    percentage: percentages[index],
    targets: {
      calories: calories[index],
      proteinGrams: protein[index],
      carbohydrateGrams: carbohydrates[index],
      fatGrams: fat[index],
    },
  }));
}
