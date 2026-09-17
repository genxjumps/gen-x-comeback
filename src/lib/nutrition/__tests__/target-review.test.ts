import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { calculateNutritionTargets } from "../calculator";
import { buildNutritionTargetReview } from "../target-review";
import type { NutritionIntake } from "../types";

function intake(overrides: Partial<NutritionIntake> = {}): NutritionIntake {
  return {
    fitnessGoal: "maintain_results",
    weightDirection: "maintain",
    weightUnit: "lb",
    currentWeight: 180,
    goalWeight: null,
    height: { unit: "imperial", feet: 6, inches: 0 },
    age: 58,
    sex: "male",
    movement: "mostly_sitting",
    training: "both",
    mealOccasions: ["breakfast", "lunch", "dinner"],
    biggestMeal: "dinner",
    ...overrides,
  };
}

function savedTargets(value: NutritionIntake) {
  const calculation = calculateNutritionTargets(value);
  if (!calculation.ok) throw new Error("Expected a valid nutrition calibration");
  return calculation.targets;
}

describe("nutrition target review", () => {
  it("does not react to normal weight noise under five pounds", () => {
    const saved = intake();
    expect(
      buildNutritionTargetReview({
        intake: saved,
        targets: savedTargets(saved),
        savedWeight: { value: 176, unit: "lb" },
      }),
    ).toBeNull();
  });

  it("proposes new targets without changing the saved profile", () => {
    const saved = intake();
    const targets = savedTargets(saved);
    const review = buildNutritionTargetReview({
      intake: saved,
      targets,
      savedWeight: { value: 170, unit: "lb" },
    });

    expect(review).not.toBeNull();
    expect(review?.currentTargets).toEqual(targets);
    expect(review?.proposedTargets).not.toEqual(targets);
    expect(saved.currentWeight).toBe(180);
  });

  it("compares metric measurements without treating the unit change as weight loss", () => {
    const saved = intake();
    expect(
      buildNutritionTargetReview({
        intake: saved,
        targets: savedTargets(saved),
        savedWeight: { value: 81.5, unit: "kg" },
      }),
    ).toBeNull();
  });

  it("ignores missing or invalid weight measurements", () => {
    const saved = intake();
    const targets = savedTargets(saved);
    expect(buildNutritionTargetReview({ intake: saved, targets, savedWeight: null })).toBeNull();
    expect(
      buildNutritionTargetReview({
        intake: saved,
        targets,
        savedWeight: { value: Number.NaN, unit: "lb" },
      }),
    ).toBeNull();
  });

  it("surfaces the review in Nutrition and Notifications without auto-saving it", () => {
    const functions = readFileSync(
      new URL("../../notifications/functions.ts", import.meta.url),
      "utf8",
    );
    const notifications = readFileSync(
      new URL("../../../routes/notifications.tsx", import.meta.url),
      "utf8",
    );
    const nutrition = readFileSync(
      new URL("../../../routes/nutrition.tsx", import.meta.url),
      "utf8",
    );

    expect(functions).toContain("nutrition_target_review");
    expect(functions).toContain("state.nutritionReview");
    expect(notifications).toContain("Review Targets");
    expect(nutrition).toContain("Review Updated Targets");
    expect(nutrition).toContain("setEditing(true)");
    expect(nutrition).not.toContain("saveNutrition({ data: targetReview");
  });
});
