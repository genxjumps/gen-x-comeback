import {
  FITNESS_GOALS,
  MEAL_OCCASIONS,
  MOVEMENT_LEVELS,
  TRAINING_TYPES,
  WEIGHT_DIRECTIONS,
  type BiggestMeal,
  type FitnessGoal,
  type MealOccasion,
  type MovementLevel,
  type TrainingType,
  type WeightDirection,
} from "./types";

export const NUTRITION_DRAFT_STORAGE_KEY = "gxj_nutrition_draft_v1";

export type NutritionDraftForm = {
  fitnessGoal: FitnessGoal | "";
  weightDirection: WeightDirection | "";
  weightUnit: "lb" | "kg";
  currentWeight: string;
  goalWeight: string;
  heightUnit: "imperial" | "metric";
  heightFeet: string;
  heightInches: string;
  heightCentimeters: string;
  age: string;
  sex: "male" | "female" | "";
  movement: MovementLevel | "";
  training: TrainingType | "";
  mealOccasions: MealOccasion[];
  biggestMeal: BiggestMeal;
};

export type NutritionDraft = {
  form: NutritionDraftForm;
  step: 1 | 2 | 3;
  editing: boolean;
};

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.includes(value as T);
}

function isNutritionDraftForm(value: unknown): value is NutritionDraftForm {
  if (!value || typeof value !== "object") return false;
  const form = value as Record<string, unknown>;
  const strings = [
    "currentWeight",
    "goalWeight",
    "heightFeet",
    "heightInches",
    "heightCentimeters",
    "age",
  ];

  return (
    (form.fitnessGoal === "" || isOneOf(form.fitnessGoal, FITNESS_GOALS)) &&
    (form.weightDirection === "" || isOneOf(form.weightDirection, WEIGHT_DIRECTIONS)) &&
    isOneOf(form.weightUnit, ["lb", "kg"] as const) &&
    isOneOf(form.heightUnit, ["imperial", "metric"] as const) &&
    strings.every((key) => typeof form[key] === "string") &&
    (form.sex === "" || isOneOf(form.sex, ["male", "female"] as const)) &&
    (form.movement === "" || isOneOf(form.movement, MOVEMENT_LEVELS)) &&
    (form.training === "" || isOneOf(form.training, TRAINING_TYPES)) &&
    Array.isArray(form.mealOccasions) &&
    form.mealOccasions.every((occasion) => isOneOf(occasion, MEAL_OCCASIONS)) &&
    (form.biggestMeal === null ||
      isOneOf(form.biggestMeal, ["breakfast", "lunch", "dinner", "same"] as const))
  );
}

export function readNutritionDraft(): NutritionDraft | null {
  try {
    const raw = window.sessionStorage.getItem(NUTRITION_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NutritionDraft>;
    if (
      !isNutritionDraftForm(parsed.form) ||
      ![1, 2, 3].includes(parsed.step ?? 0) ||
      typeof parsed.editing !== "boolean"
    )
      return null;
    return parsed as NutritionDraft;
  } catch {
    return null;
  }
}

export function writeNutritionDraft(draft: NutritionDraft): void {
  try {
    window.sessionStorage.setItem(NUTRITION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // The form remains usable when browser storage is unavailable.
  }
}

export function clearNutritionDraft(): void {
  try {
    window.sessionStorage.removeItem(NUTRITION_DRAFT_STORAGE_KEY);
  } catch {
    // Saving and cancellation must remain usable when browser storage is unavailable.
  }
}
