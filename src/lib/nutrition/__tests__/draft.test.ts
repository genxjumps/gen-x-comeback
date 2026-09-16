import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearNutritionDraft,
  NUTRITION_DRAFT_STORAGE_KEY,
  readNutritionDraft,
  writeNutritionDraft,
  type NutritionDraft,
} from "@/lib/nutrition/draft";

const draft: NutritionDraft = {
  editing: false,
  step: 2,
  form: {
    fitnessGoal: "lose_fat",
    weightDirection: "lose",
    weightUnit: "lb",
    currentWeight: "175",
    goalWeight: "165",
    heightUnit: "imperial",
    heightFeet: "6",
    heightInches: "1",
    heightCentimeters: "",
    age: "59",
    sex: "male",
    movement: "mostly_sitting",
    training: "both",
    mealOccasions: ["breakfast", "lunch", "dinner"],
    biggestMeal: "dinner",
  },
};

function stubStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  return values;
}

describe("nutrition setup draft", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves, restores, and clears the current setup step and answers", () => {
    const values = stubStorage();

    writeNutritionDraft(draft);
    expect(readNutritionDraft()).toEqual(draft);
    expect(values.has(NUTRITION_DRAFT_STORAGE_KEY)).toBe(true);

    clearNutritionDraft();
    expect(readNutritionDraft()).toBeNull();
  });

  it("ignores malformed or incomplete drafts", () => {
    const values = stubStorage();
    values.set(NUTRITION_DRAFT_STORAGE_KEY, "not-json");
    expect(readNutritionDraft()).toBeNull();

    values.set(NUTRITION_DRAFT_STORAGE_KEY, JSON.stringify({ step: 4, form: draft.form }));
    expect(readNutritionDraft()).toBeNull();

    values.set(
      NUTRITION_DRAFT_STORAGE_KEY,
      JSON.stringify({ step: 2, editing: false, form: { ...draft.form, mealOccasions: null } }),
    );
    expect(readNutritionDraft()).toBeNull();
  });
});
