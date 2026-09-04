export const NUTRITION_FORMULA_VERSION = "nutrition_targets_v1_2026_09_04" as const;

export const FITNESS_GOALS = [
  "lose_fat",
  "add_lean_muscle_and_lose_fat",
  "add_lean_muscle",
  "maintain_results",
] as const;
export type FitnessGoal = (typeof FITNESS_GOALS)[number];

export const WEIGHT_DIRECTIONS = ["lose", "maintain", "add_slowly"] as const;
export type WeightDirection = (typeof WEIGHT_DIRECTIONS)[number];

export const MOVEMENT_LEVELS = ["mostly_sitting", "on_feet", "physical_work"] as const;
export type MovementLevel = (typeof MOVEMENT_LEVELS)[number];

export const TRAINING_TYPES = ["conditioning", "strength", "both", "none"] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export const MEAL_OCCASIONS = ["breakfast", "lunch", "dinner", "extras"] as const;
export type MealOccasion = (typeof MEAL_OCCASIONS)[number];
export type MainMeal = Exclude<MealOccasion, "extras">;
export type BiggestMeal = MainMeal | "same" | null;
export type MealSliderPosition = 1 | 2 | 3 | 4 | 5;

export type NutritionHeight =
  | { unit: "imperial"; feet: number; inches: number }
  | { unit: "metric"; centimeters: number };

export type NutritionIntake = {
  fitnessGoal: FitnessGoal;
  weightDirection: WeightDirection;
  weightUnit: "lb" | "kg";
  currentWeight: number;
  goalWeight: number | null;
  height: NutritionHeight;
  age: number;
  sex: "male" | "female";
  movement: MovementLevel;
  training: TrainingType;
  mealOccasions: MealOccasion[];
  biggestMeal: BiggestMeal;
};

export type NutritionTargets = {
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
};

export type NutritionCalculation =
  | {
      ok: true;
      maintenanceCalories: number;
      targets: NutritionTargets;
    }
  | { ok: false; reason: "goal_below_healthy_range" | "calorie_floor" | "unsuitable_macros" };

export type MealSliderPositions = Partial<Record<MealOccasion, MealSliderPosition>>;

export type MealAllocation = {
  occasion: MealOccasion;
  position: MealSliderPosition;
  percentage: number;
  targets: NutritionTargets;
};

export type NutritionProfile = {
  formulaVersion: typeof NUTRITION_FORMULA_VERSION;
  intake: NutritionIntake;
  maintenanceCalories: number;
  targets: NutritionTargets;
  sliderPositions: MealSliderPositions;
  calculatedAt: string;
};

export type SavedWeightPrefill = { value: number; unit: "lb" | "kg" } | null;

export type NutritionProfileResult =
  | { ok: false }
  | { ok: true; access: "locked" }
  | {
      ok: true;
      access: "eligible";
      profile: NutritionProfile | null;
      savedWeight: SavedWeightPrefill;
    };

export type SaveNutritionProfileResult =
  | { ok: true; profile: NutritionProfile }
  | { ok: false; reason: "unauthorized" | "locked" | "stopped" };
