import { describe, expect, it } from "vitest";

import {
  allocateMealTargets,
  calculateNutritionTargets,
  recommendedSliderPositions,
} from "../calculator";
import { nutritionIntakeSchema } from "../schemas";
import type { NutritionIntake } from "../types";

function intake(overrides: Partial<NutritionIntake> = {}): NutritionIntake {
  return {
    fitnessGoal: "lose_fat",
    weightDirection: "lose",
    weightUnit: "lb",
    currentWeight: 176,
    goalWeight: 175,
    height: { unit: "imperial", feet: 6, inches: 1 },
    age: 60,
    sex: "male",
    movement: "mostly_sitting",
    training: "strength",
    mealOccasions: ["breakfast", "lunch", "dinner", "extras"],
    biggestMeal: "dinner",
    ...overrides,
  };
}

function expectTargets(
  input: NutritionIntake,
  expected: {
    maintenance: number;
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
  },
) {
  const result = calculateNutritionTargets(input);
  expect(result).toEqual({
    ok: true,
    maintenanceCalories: expected.maintenance,
    targets: {
      calories: expected.calories,
      proteinGrams: expected.protein,
      carbohydrateGrams: expected.carbohydrates,
      fatGrams: expected.fat,
    },
  });
}

describe("approved nutrition target calculation", () => {
  it("matches the sitting and on-feet Todd calibration cases", () => {
    expectTargets(intake(), {
      maintenance: 2100,
      calories: 1900,
      protein: 195,
      carbohydrates: 155,
      fat: 55,
    });
    expectTargets(intake({ movement: "on_feet" }), {
      maintenance: 2350,
      calories: 2100,
      protein: 195,
      carbohydrates: 195,
      fat: 60,
    });
  });

  it("caps an excess-weight protein reference at the healthy-range upper boundary", () => {
    const base = intake({
      currentWeight: 205,
      goalWeight: 160,
      height: { unit: "imperial", feet: 5, inches: 4 },
      age: 55,
      sex: "female",
      training: "none",
    });
    expectTargets(base, {
      maintenance: 1900,
      calories: 1700,
      protein: 145,
      carbohydrates: 180,
      fat: 45,
    });
    expectTargets(
      { ...base, training: "strength" },
      {
        maintenance: 1900,
        calories: 1700,
        protein: 160,
        carbohydrates: 165,
        fat: 45,
      },
    );
  });

  it.each([
    {
      label: "larger man losing weight",
      input: intake({
        currentWeight: 235,
        goalWeight: 200,
        movement: "on_feet",
      }),
      expected: { maintenance: 2750, calories: 2500, protein: 210, carbohydrates: 260, fat: 70 },
    },
    {
      label: "shorter woman losing weight",
      input: intake({
        currentWeight: 200,
        goalWeight: 140,
        height: { unit: "imperial", feet: 4, inches: 11 },
        age: 65,
        sex: "female",
      }),
      expected: { maintenance: 1700, calories: 1550, protein: 135, carbohydrates: 150, fat: 45 },
    },
    {
      label: "woman maintaining",
      input: intake({
        fitnessGoal: "maintain_results",
        weightDirection: "maintain",
        currentWeight: 155,
        goalWeight: null,
        height: { unit: "imperial", feet: 5, inches: 6 },
        age: 58,
        sex: "female",
        movement: "on_feet",
      }),
      expected: { maintenance: 1850, calories: 1850, protein: 170, carbohydrates: 180, fat: 50 },
    },
    {
      label: "man adding weight slowly without a bulk surplus",
      input: intake({
        fitnessGoal: "add_lean_muscle",
        weightDirection: "add_slowly",
        currentWeight: 170,
        goalWeight: 180,
        height: { unit: "imperial", feet: 5, inches: 10 },
        age: 55,
        movement: "on_feet",
      }),
      expected: { maintenance: 2300, calories: 2300, protein: 190, carbohydrates: 240, fat: 65 },
    },
    {
      label: "large active man with the maximum deficit controlling",
      input: intake({
        currentWeight: 350,
        goalWeight: 250,
        height: { unit: "imperial", feet: 6, inches: 5 },
        age: 50,
        movement: "physical_work",
      }),
      expected: { maintenance: 4000, calories: 3600, protein: 230, carbohydrates: 445, fat: 100 },
    },
    {
      label: "metric customer",
      input: intake({
        weightUnit: "kg",
        currentWeight: 79,
        goalWeight: 77,
        height: { unit: "metric", centimeters: 185 },
      }),
      expected: { maintenance: 2100, calories: 1900, protein: 185, carbohydrates: 165, fat: 55 },
    },
  ])("matches the $label calibration case", ({ input: testInput, expected }) => {
    expectTargets(testInput, expected);
  });

  it("stops instead of silently raising a result to the calorie floor", () => {
    expect(
      calculateNutritionTargets(
        intake({
          currentWeight: 110,
          goalWeight: 100,
          height: { unit: "imperial", feet: 4, inches: 10 },
          age: 70,
          sex: "female",
          training: "none",
        }),
      ),
    ).toEqual({ ok: false, reason: "calorie_floor" });
  });

  it("stops on a goal below the standard height-based healthy range", () => {
    expect(calculateNutritionTargets(intake({ currentWeight: 176, goalWeight: 120 }))).toEqual({
      ok: false,
      reason: "goal_below_healthy_range",
    });
  });
});

describe("nutrition intake validation", () => {
  it("enforces units, ranges, goal direction, and at least one eating occasion", () => {
    expect(nutritionIntakeSchema.safeParse(intake()).success).toBe(true);
    expect(nutritionIntakeSchema.safeParse(intake({ age: 17 })).success).toBe(false);
    expect(nutritionIntakeSchema.safeParse(intake({ currentWeight: 69 })).success).toBe(false);
    expect(nutritionIntakeSchema.safeParse(intake({ goalWeight: 176 })).success).toBe(false);
    expect(nutritionIntakeSchema.safeParse(intake({ mealOccasions: [] })).success).toBe(false);
    expect(
      nutritionIntakeSchema.safeParse(
        intake({ weightUnit: "kg", currentWeight: 31, goalWeight: 30 }),
      ).success,
    ).toBe(false);
  });

  it("allows slow weight gain only with a lean-muscle goal", () => {
    expect(
      nutritionIntakeSchema.safeParse(
        intake({
          fitnessGoal: "lose_fat",
          weightDirection: "add_slowly",
          currentWeight: 170,
          goalWeight: 175,
        }),
      ).success,
    ).toBe(false);
    expect(
      nutritionIntakeSchema.safeParse(
        intake({
          fitnessGoal: "add_lean_muscle_and_lose_fat",
          weightDirection: "add_slowly",
          currentWeight: 170,
          goalWeight: 175,
        }),
      ).success,
    ).toBe(true);
  });

  it("keeps the biggest-meal answer consistent with the selected occasions", () => {
    expect(
      nutritionIntakeSchema.safeParse(
        intake({ mealOccasions: ["extras"], biggestMeal: "breakfast" }),
      ).success,
    ).toBe(false);
    expect(
      nutritionIntakeSchema.safeParse(intake({ mealOccasions: ["extras"], biggestMeal: null }))
        .success,
    ).toBe(true);
  });
});

describe("normal-day allocation", () => {
  const targets = { calories: 1900, proteinGrams: 195, carbohydrateGrams: 155, fatGrams: 55 };

  it("uses the approved recommended positions and deterministic percentages", () => {
    const input = intake();
    expect(recommendedSliderPositions(input)).toEqual({
      breakfast: 3,
      lunch: 3,
      dinner: 4,
      extras: 2,
    });
    expect(allocateMealTargets(targets, input).map(({ percentage }) => percentage)).toEqual([
      25, 25, 33, 17,
    ]);
  });

  it("keeps every displayed allocation equal to the daily totals after slider changes", () => {
    const allocations = allocateMealTargets(targets, intake(), {
      breakfast: 1,
      lunch: 2,
      dinner: 5,
      extras: 4,
    });
    expect(allocations.reduce((sum, meal) => sum + meal.percentage, 0)).toBe(100);
    expect(allocations.reduce((sum, meal) => sum + meal.targets.calories, 0)).toBe(1900);
    expect(allocations.reduce((sum, meal) => sum + meal.targets.proteinGrams, 0)).toBe(195);
    expect(allocations.reduce((sum, meal) => sum + meal.targets.carbohydrateGrams, 0)).toBe(155);
    expect(allocations.reduce((sum, meal) => sum + meal.targets.fatGrams, 0)).toBe(55);
  });

  it("gives a one-meal customer the whole day without requiring a slider", () => {
    const oneMealInput = intake({ mealOccasions: ["dinner"], biggestMeal: "dinner" });
    expect(allocateMealTargets(targets, oneMealInput)).toEqual([
      { occasion: "dinner", position: 3, percentage: 100, targets },
    ]);
  });
});
