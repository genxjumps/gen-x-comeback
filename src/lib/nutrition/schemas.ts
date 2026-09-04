import { z } from "zod";

import {
  FITNESS_GOALS,
  MEAL_OCCASIONS,
  MOVEMENT_LEVELS,
  NUTRITION_FORMULA_VERSION,
  TRAINING_TYPES,
  WEIGHT_DIRECTIONS,
} from "@/lib/nutrition/types";

const weightUnitSchema = z.enum(["lb", "kg"]);
const weightSchema = z.number().finite().positive();

const heightSchema = z.discriminatedUnion("unit", [
  z.object({
    unit: z.literal("imperial"),
    feet: z.number().int().min(4).max(7),
    inches: z.number().int().min(0).max(11),
  }),
  z.object({
    unit: z.literal("metric"),
    centimeters: z.number().finite().min(122).max(213),
  }),
]);

export const nutritionIntakeSchema = z
  .object({
    fitnessGoal: z.enum(FITNESS_GOALS),
    weightDirection: z.enum(WEIGHT_DIRECTIONS),
    weightUnit: weightUnitSchema,
    currentWeight: weightSchema,
    goalWeight: weightSchema.nullable(),
    height: heightSchema,
    age: z.number().int().min(18).max(100),
    sex: z.enum(["male", "female"]),
    movement: z.enum(MOVEMENT_LEVELS),
    training: z.enum(TRAINING_TYPES),
    mealOccasions: z.array(z.enum(MEAL_OCCASIONS)).min(1).max(MEAL_OCCASIONS.length),
    biggestMeal: z.enum(["breakfast", "lunch", "dinner", "same"]).nullable(),
  })
  .superRefine((input, context) => {
    const bounds = input.weightUnit === "lb" ? { min: 70, max: 700 } : { min: 32, max: 318 };
    const checkWeight = (value: number | null, path: "currentWeight" | "goalWeight") => {
      if (value !== null && (value < bounds.min || value > bounds.max)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: `Enter a weight between ${bounds.min} and ${bounds.max} ${input.weightUnit}.`,
        });
      }
    };
    checkWeight(input.currentWeight, "currentWeight");
    checkWeight(input.goalWeight, "goalWeight");

    if (input.height.unit === "imperial") {
      const totalInches = input.height.feet * 12 + input.height.inches;
      if (totalInches < 48 || totalInches > 84) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["height"],
          message: "Enter a height from 4 ft 0 in through 7 ft 0 in.",
        });
      }
    }

    if (new Set(input.mealOccasions).size !== input.mealOccasions.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mealOccasions"],
        message: "Choose each eating occasion only once.",
      });
    }

    if (input.weightDirection === "maintain") {
      if (input.goalWeight !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["goalWeight"],
          message: "A goal weight is not needed when maintaining your current weight.",
        });
      }
    } else if (input.goalWeight === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["goalWeight"],
        message: "Enter your goal weight.",
      });
    } else if (input.weightDirection === "lose" && input.goalWeight >= input.currentWeight) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["goalWeight"],
        message: "Your goal weight must be below your current weight.",
      });
    } else if (input.weightDirection === "add_slowly" && input.goalWeight <= input.currentWeight) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["goalWeight"],
        message: "Your goal weight must be above your current weight.",
      });
    }

    if (
      input.weightDirection === "add_slowly" &&
      !["add_lean_muscle", "add_lean_muscle_and_lose_fat"].includes(input.fitnessGoal)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weightDirection"],
        message: "Add weight slowly is available with an add-lean-muscle goal.",
      });
    }

    const selectedMainMeals = input.mealOccasions.filter((occasion) => occasion !== "extras");
    if (selectedMainMeals.length <= 1 && input.biggestMeal !== (selectedMainMeals[0] ?? null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["biggestMeal"],
        message: "The biggest-meal answer does not match the selected meals.",
      });
    } else if (
      selectedMainMeals.length > 1 &&
      (!input.biggestMeal ||
        (input.biggestMeal !== "same" && !selectedMainMeals.includes(input.biggestMeal)))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["biggestMeal"],
        message: "Choose the biggest meal from the meals you selected.",
      });
    }
  });

const sliderPositionSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const mealSliderPositionsSchema = z
  .object({
    breakfast: sliderPositionSchema.optional(),
    lunch: sliderPositionSchema.optional(),
    dinner: sliderPositionSchema.optional(),
    extras: sliderPositionSchema.optional(),
  })
  .strict();

export const saveNutritionProfileInputSchema = z.object({
  intake: nutritionIntakeSchema,
  sliderPositions: mealSliderPositionsSchema.optional(),
});

export const nutritionAccountInputSchema = z.object({});

export const nutritionTargetsSchema = z.object({
  calories: z.number().int().positive(),
  proteinGrams: z.number().int().positive(),
  carbohydrateGrams: z.number().int().nonnegative(),
  fatGrams: z.number().int().positive(),
});

export const nutritionProfileSchema = z.object({
  formulaVersion: z.literal(NUTRITION_FORMULA_VERSION),
  intake: nutritionIntakeSchema,
  maintenanceCalories: z.number().int().positive(),
  targets: nutritionTargetsSchema,
  sliderPositions: mealSliderPositionsSchema,
  calculatedAt: z.string().datetime(),
});
