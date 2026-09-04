import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Info, RotateCcw } from "lucide-react";

import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  allocateMealTargets,
  calculateNutritionTargets,
  recommendedSliderPositions,
} from "@/lib/nutrition/calculator";
import { getNutritionProfile, saveNutritionProfile } from "@/lib/nutrition/functions";
import { nutritionIntakeSchema } from "@/lib/nutrition/schemas";
import type {
  BiggestMeal,
  FitnessGoal,
  MealOccasion,
  MealSliderPosition,
  MealSliderPositions,
  MovementLevel,
  NutritionIntake,
  NutritionProfile,
  NutritionProfileResult,
  TrainingType,
  WeightDirection,
} from "@/lib/nutrition/types";
import { MEAL_OCCASIONS } from "@/lib/nutrition/types";

export const Route = createFileRoute("/nutrition")({
  head: () => ({
    meta: [
      { title: "Your Nutrition | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Nutrition,
});

const fitnessGoalOptions: { label: string; value: FitnessGoal }[] = [
  { label: "Lose fat", value: "lose_fat" },
  { label: "Add lean muscle and lose fat", value: "add_lean_muscle_and_lose_fat" },
  { label: "Add lean muscle", value: "add_lean_muscle" },
  { label: "Maintain your results", value: "maintain_results" },
];

const weightDirectionOptions: { label: string; value: WeightDirection }[] = [
  { label: "Lose weight", value: "lose" },
  { label: "Maintain my current weight", value: "maintain" },
  { label: "Add weight slowly", value: "add_slowly" },
];

const movementOptions: { label: string; value: MovementLevel }[] = [
  { label: "Mostly sitting", value: "mostly_sitting" },
  { label: "On my feet most of the day", value: "on_feet" },
  { label: "Physically active work", value: "physical_work" },
];

const trainingOptions: { label: string; value: TrainingType }[] = [
  { label: "Jump rope or conditioning", value: "conditioning" },
  { label: "Strength training", value: "strength" },
  { label: "Both", value: "both" },
  { label: "Not training right now", value: "none" },
];

const mealLabels: Record<MealOccasion, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  extras: "Snacks, shakes, or dessert",
};

type FormState = {
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

const emptyForm: FormState = {
  fitnessGoal: "",
  weightDirection: "",
  weightUnit: "lb",
  currentWeight: "",
  goalWeight: "",
  heightUnit: "imperial",
  heightFeet: "",
  heightInches: "",
  heightCentimeters: "",
  age: "",
  sex: "",
  movement: "",
  training: "",
  mealOccasions: [],
  biggestMeal: null,
};

function choiceId(name: string, value: string): string {
  return `nutrition-${name}-${value}`;
}

function ChoiceGroup<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T | "";
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  return (
    <RadioGroup value={value} onValueChange={(next) => onChange(next as T)} className="gap-2">
      {options.map((option) => (
        <Label
          key={option.value}
          htmlFor={choiceId(name, option.value)}
          className="gxj-choice flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-normal leading-snug"
        >
          <RadioGroupItem id={choiceId(name, option.value)} value={option.value} />
          <span>{option.label}</span>
        </Label>
      ))}
    </RadioGroup>
  );
}

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold leading-snug">{title}</h2>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function profileToForm(profile: NutritionProfile): FormState {
  const { intake } = profile;
  return {
    fitnessGoal: intake.fitnessGoal,
    weightDirection: intake.weightDirection,
    weightUnit: intake.weightUnit,
    currentWeight: String(intake.currentWeight),
    goalWeight: intake.goalWeight === null ? "" : String(intake.goalWeight),
    heightUnit: intake.height.unit,
    heightFeet: intake.height.unit === "imperial" ? String(intake.height.feet) : "",
    heightInches: intake.height.unit === "imperial" ? String(intake.height.inches) : "",
    heightCentimeters: intake.height.unit === "metric" ? String(intake.height.centimeters) : "",
    age: String(intake.age),
    sex: intake.sex,
    movement: intake.movement,
    training: intake.training,
    mealOccasions: intake.mealOccasions,
    biggestMeal: intake.biggestMeal,
  };
}

function sameMealPattern(left: NutritionIntake, right: NutritionIntake): boolean {
  return (
    left.biggestMeal === right.biggestMeal &&
    left.mealOccasions.length === right.mealOccasions.length &&
    left.mealOccasions.every((occasion, index) => occasion === right.mealOccasions[index])
  );
}

function formToIntake(form: FormState): NutritionIntake | null {
  if (!form.fitnessGoal || !form.weightDirection || !form.sex || !form.movement || !form.training) {
    return null;
  }
  const mainMeals = form.mealOccasions.filter(
    (occasion): occasion is Exclude<MealOccasion, "extras"> => occasion !== "extras",
  );
  const biggestMeal =
    mainMeals.length <= 1
      ? (mainMeals[0] ?? null)
      : form.biggestMeal === null
        ? null
        : form.biggestMeal;
  const height =
    form.heightUnit === "imperial"
      ? {
          unit: "imperial" as const,
          feet: Number(form.heightFeet),
          inches: Number(form.heightInches),
        }
      : { unit: "metric" as const, centimeters: Number(form.heightCentimeters) };

  return {
    fitnessGoal: form.fitnessGoal,
    weightDirection: form.weightDirection,
    weightUnit: form.weightUnit,
    currentWeight: Number(form.currentWeight),
    goalWeight: form.weightDirection === "maintain" ? null : Number(form.goalWeight),
    height,
    age: Number(form.age),
    sex: form.sex,
    movement: form.movement,
    training: form.training,
    mealOccasions: form.mealOccasions,
    biggestMeal,
  };
}

function TargetCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function NutritionWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <p className="text-sm leading-relaxed">
          Your Nutrition gives you starting calorie and macro targets, then shows how those numbers
          fit across the way you actually eat. It does not require food logging.
        </p>
        <ul className="mt-4 space-y-2 text-sm font-medium">
          <li>Calories still matter.</li>
          <li>Protein comes first.</li>
          <li>Build meals around protein.</li>
          <li>Repeat simple meals that work.</li>
        </ul>
        <Button type="button" size="lg" className="mt-6 w-full sm:w-auto" onClick={onStart}>
          Set Up My Starting Targets
        </Button>
      </section>
      <a
        href="https://genxjumps.com/nutrition/"
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/35 p-5 font-semibold transition-colors hover:bg-muted/55"
      >
        <span>
          Learn the basics
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Deeper nutrition explanations and examples on Gen X Jumps.
          </span>
        </span>
        <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      </a>
    </div>
  );
}

function SetupForm({
  form,
  saving,
  error,
  stopped,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  saving: boolean;
  error: string | null;
  stopped: boolean;
  submitLabel: string;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const selectedMainMeals = form.mealOccasions.filter((occasion) => occasion !== "extras");
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  function toggleMeal(occasion: MealOccasion, checked: boolean) {
    const selected = new Set(form.mealOccasions);
    if (checked) selected.add(occasion);
    else selected.delete(occasion);
    const mealOccasions = MEAL_OCCASIONS.filter((current) => selected.has(current));
    const mainMeals = mealOccasions.filter((current) => current !== "extras");
    if (form.biggestMeal && form.biggestMeal !== "same" && !mainMeals.includes(form.biggestMeal)) {
      onChange({ ...form, mealOccasions, biggestMeal: null });
      return;
    }
    onChange({ ...form, mealOccasions });
  }

  return (
    <div className="space-y-4">
      <FormSection title="What is your current fitness goal?">
        <ChoiceGroup
          name="fitness-goal"
          value={form.fitnessGoal}
          options={fitnessGoalOptions}
          onChange={(value) => set("fitnessGoal", value)}
        />
      </FormSection>

      <FormSection title="What do you want your body weight to do?">
        <ChoiceGroup
          name="weight-direction"
          value={form.weightDirection}
          options={weightDirectionOptions}
          onChange={(value) =>
            onChange({
              ...form,
              weightDirection: value,
              goalWeight: value === "maintain" ? "" : form.goalWeight,
            })
          }
        />
      </FormSection>

      <FormSection title="Your starting numbers">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nutrition-current-weight">Current weight</Label>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
              <Input
                id="nutrition-current-weight"
                type="number"
                min={form.weightUnit === "lb" ? 70 : 32}
                max={form.weightUnit === "lb" ? 700 : 318}
                step="0.1"
                inputMode="decimal"
                value={form.currentWeight}
                onChange={(event) => set("currentWeight", event.target.value)}
              />
              <Select
                value={form.weightUnit}
                onValueChange={(value) => set("weightUnit", value as "lb" | "kg")}
              >
                <SelectTrigger aria-label="Weight unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lb">lb</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.weightDirection && form.weightDirection !== "maintain" ? (
            <div>
              <Label htmlFor="nutrition-goal-weight">Goal weight</Label>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                <Input
                  id="nutrition-goal-weight"
                  type="number"
                  min={form.weightUnit === "lb" ? 70 : 32}
                  max={form.weightUnit === "lb" ? 700 : 318}
                  step="0.1"
                  inputMode="decimal"
                  value={form.goalWeight}
                  onChange={(event) => set("goalWeight", event.target.value)}
                />
                <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm">
                  {form.weightUnit}
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <Label>Height</Label>
            <Select
              value={form.heightUnit}
              onValueChange={(value) => set("heightUnit", value as "imperial" | "metric")}
            >
              <SelectTrigger className="mt-2" aria-label="Height unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imperial">Feet and inches</SelectItem>
                <SelectItem value="metric">Centimeters</SelectItem>
              </SelectContent>
            </Select>
            {form.heightUnit === "imperial" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="sr-only" htmlFor="nutrition-height-feet">
                    Height in feet
                  </Label>
                  <Input
                    id="nutrition-height-feet"
                    type="number"
                    min="4"
                    max="7"
                    step="1"
                    inputMode="numeric"
                    placeholder="Feet"
                    value={form.heightFeet}
                    onChange={(event) => set("heightFeet", event.target.value)}
                  />
                </div>
                <div>
                  <Label className="sr-only" htmlFor="nutrition-height-inches">
                    Height in inches
                  </Label>
                  <Input
                    id="nutrition-height-inches"
                    type="number"
                    min="0"
                    max="11"
                    step="1"
                    inputMode="numeric"
                    placeholder="Inches"
                    value={form.heightInches}
                    onChange={(event) => set("heightInches", event.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <Label className="sr-only" htmlFor="nutrition-height-centimeters">
                  Height in centimeters
                </Label>
                <Input
                  id="nutrition-height-centimeters"
                  type="number"
                  min="122"
                  max="213"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Centimeters"
                  value={form.heightCentimeters}
                  onChange={(event) => set("heightCentimeters", event.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="nutrition-age">Age</Label>
            <Input
              id="nutrition-age"
              className="mt-2"
              type="number"
              min="18"
              max="100"
              step="1"
              inputMode="numeric"
              value={form.age}
              onChange={(event) => set("age", event.target.value)}
            />
          </div>
        </div>
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Sex used for the calorie calculation</legend>
          <div className="mt-2">
            <ChoiceGroup
              name="sex"
              value={form.sex}
              options={[
                { label: "Male", value: "male" as const },
                { label: "Female", value: "female" as const },
              ]}
              onChange={(value) => set("sex", value)}
            />
          </div>
        </fieldset>
      </FormSection>

      <FormSection title="Outside of workouts, how active is your typical day?">
        <ChoiceGroup
          name="movement"
          value={form.movement}
          options={movementOptions}
          onChange={(value) => set("movement", value)}
        />
      </FormSection>

      <FormSection title="How are you training right now?">
        <ChoiceGroup
          name="training"
          value={form.training}
          options={trainingOptions}
          onChange={(value) => set("training", value)}
        />
      </FormSection>

      <FormSection
        title="On a typical weekday, which of these eating occasions do you use?"
        hint="Choose at least one. This shapes the meal-by-meal view, not your daily targets."
      >
        <div className="grid gap-2">
          {(Object.keys(mealLabels) as MealOccasion[]).map((occasion) => (
            <Label
              key={occasion}
              htmlFor={choiceId("meal", occasion)}
              className="gxj-choice flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-normal leading-snug"
            >
              <input
                id={choiceId("meal", occasion)}
                type="checkbox"
                className="size-4 accent-gxj-teal"
                checked={form.mealOccasions.includes(occasion)}
                onChange={(event) => toggleMeal(occasion, event.target.checked)}
              />
              <span>{mealLabels[occasion]}</span>
            </Label>
          ))}
        </div>
      </FormSection>

      {selectedMainMeals.length > 1 ? (
        <FormSection title="Which meal tends to be your biggest?">
          <ChoiceGroup
            name="biggest-meal"
            value={form.biggestMeal ?? ""}
            options={[
              ...selectedMainMeals.map((occasion) => ({
                label: mealLabels[occasion],
                value: occasion,
              })),
              { label: "They're about the same", value: "same" as const },
            ]}
            onChange={(value) => set("biggestMeal", value)}
          />
        </FormSection>
      ) : null}

      <div aria-live="polite">
        {stopped ? (
          <p className="rounded-md border border-border bg-muted/50 p-4 text-sm font-medium">
            These inputs need an individualized nutrition target. Work with a registered dietitian
            instead of using this calculator.
          </p>
        ) : error ? (
          <p className="rounded-md border border-border bg-muted/50 p-4 text-sm font-medium">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="button" size="lg" disabled={saving} onClick={onSubmit}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function NutritionResults({
  profile,
  saving,
  message,
  sliderPositions,
  onEdit,
  onSliderChange,
  onReset,
  onSaveSplit,
}: {
  profile: NutritionProfile;
  saving: boolean;
  message: string | null;
  sliderPositions: MealSliderPositions;
  onEdit: () => void;
  onSliderChange: (occasion: MealOccasion, position: MealSliderPosition) => void;
  onReset: () => void;
  onSaveSplit: () => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const allocations = useMemo(
    () => allocateMealTargets(profile.targets, profile.intake, sliderPositions),
    [profile, sliderPositions],
  );
  const oneMeal = allocations.length === 1;
  const muscleGoal = ["add_lean_muscle", "add_lean_muscle_and_lose_fat"].includes(
    profile.intake.fitnessGoal,
  );
  const strengthTraining = ["strength", "both"].includes(profile.intake.training);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
              Starting Targets
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              These are your numbers for the whole day.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every meal counts. All seven days count.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onEdit}>
            Update Targets
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TargetCard label="Calories" value={profile.targets.calories.toLocaleString()} />
          <TargetCard label="Protein" value={`${profile.targets.proteinGrams} g`} />
          <TargetCard label="Carbs" value={`${profile.targets.carbohydrateGrams} g`} />
          <TargetCard label="Fat" value={`${profile.targets.fatGrams} g`} />
        </div>

        <details className="mt-4 rounded-md border border-border bg-muted/30 p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
            <Info aria-hidden="true" className="size-4" />
            What are these?
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Starting estimate, not medical nutrition advice. If you follow a medical diet or have
            been told to limit protein, work with a registered dietitian.
          </p>
        </details>

        {profile.intake.weightDirection === "add_slowly" ? (
          <p className="mt-4 text-sm leading-relaxed">
            This is not a bulk. Your starting calorie target stays at estimated maintenance. Build
            strength, watch your waist and performance, and do not chase fast scale gain.
          </p>
        ) : null}
        {muscleGoal && !strengthTraining ? (
          <p className="mt-4 text-sm leading-relaxed">
            Protein supports muscle. Protein alone does not build it. Strength training provides the
            signal.
          </p>
        ) : null}
        {muscleGoal ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Scale weight is only one signal. Track your waist and capability in{" "}
            <Link
              to="/progress"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Your Progress
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
              Your Normal Day
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              See how the numbers work across your day.
            </h2>
          </div>
          {!oneMeal && adjusting ? (
            <Button type="button" variant="outline" size="sm" onClick={onReset}>
              <RotateCcw aria-hidden="true" className="size-4" />
              Reset Split
            </Button>
          ) : !oneMeal ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setAdjusting(true)}>
              Adjust Your Day
            </Button>
          ) : null}
        </div>

        {oneMeal ? (
          <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
            You selected one eating occasion. The full daily calorie and macro targets have to fit
            that occasion.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Adjust the sliders to match how you actually eat. This changes the split, not your daily
            totals.
          </p>
        )}

        <div className="mt-5 space-y-3">
          {allocations.map((allocation) => (
            <div
              key={allocation.occasion}
              className="rounded-md border border-border bg-background p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{mealLabels[allocation.occasion]}</h3>
                <p className="text-sm font-semibold">{allocation.percentage}%</p>
              </div>
              {!oneMeal && adjusting ? (
                <div className="mt-3">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={allocation.position}
                    aria-label={`${mealLabels[allocation.occasion]} share`}
                    aria-valuetext={`${allocation.percentage} percent of daily targets`}
                    className="w-full accent-gxj-teal"
                    onChange={(event) =>
                      onSliderChange(
                        allocation.occasion,
                        Number(event.target.value) as MealSliderPosition,
                      )
                    }
                  />
                  <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Smaller</span>
                    <span>Larger</span>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <span>{allocation.targets.calories.toLocaleString()} cal</span>
                <span>{allocation.targets.proteinGrams} g protein</span>
                <span>{allocation.targets.carbohydrateGrams} g carbs</span>
                <span>{allocation.targets.fatGrams} g fat</span>
              </div>
            </div>
          ))}
        </div>

        {!oneMeal && adjusting ? (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {message ? (
              <p className="mr-auto text-sm font-medium" aria-live="polite">
                {message}
              </p>
            ) : null}
            <Button type="button" disabled={saving} onClick={onSaveSplit}>
              {saving ? "Saving..." : "Save Day Split"}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
          Build Meals That Work
        </p>
        <h2 className="mt-2 text-xl font-semibold">Keep the food simple.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Start with protein. Use labels, serving sizes, and standard nutrition information to fit
          the rest of each meal to its numbers. A small rotation is enough: one or two breakfasts,
          one or two lunches, up to three dinners, and a few smart snack options.
        </p>
        <p className="mt-3 text-sm leading-relaxed">
          Lean meat, eggs, potatoes, rice, beans, vegetables, fruit, yogurt, and other foods with
          predictable numbers make this easier. Plenty of filling, enjoyable food fits the plan. You
          do not have to go hungry.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
          My Normal Day
        </p>
        <h2 className="mt-2 text-xl font-semibold">I keep the structure and adjust the extras.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Most of my meals stay the same when I want to lean out. I do not rebuild my whole diet. I
          remove or reduce the parts adding extra calories while keeping the protein-centered
          structure and foods I already like.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-4">
            <h3 className="font-semibold">Maintenance</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed">
              <li>
                <strong>Breakfast:</strong> 1 cup egg whites, 3 whole eggs, 1/2 cup uncooked
                oatmeal, 5 g creatine
              </li>
              <li>
                <strong>Lunch:</strong> 1 banana and 25 g protein powder
              </li>
              <li>
                <strong>Dinner:</strong> 1 lb 99% lean ground chicken, 1/2 Japanese sweet potato,
                1/2 can black beans, 1/2 can sweet peas, hot sauce
              </li>
              <li>
                <strong>Dessert:</strong> 50 g protein powder
              </li>
            </ul>
          </div>
          <div className="rounded-md border border-border p-4">
            <h3 className="font-semibold">When I want to cut body fat</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed">
              <li>
                <strong>Breakfast:</strong> 1 cup egg whites, 3 whole eggs, 5 g creatine
              </li>
              <li>
                <strong>Lunch:</strong> 1 banana and 25 g protein powder
              </li>
              <li>
                <strong>Dinner:</strong> 1 lb 99% lean ground chicken, 1/2 Japanese sweet potato,
                1/2 can black beans, hot sauce
              </li>
              <li>
                <strong>Dessert:</strong> 50 g protein powder
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed">
          This is how I use the method. It is not a command for you to eat the same foods I eat.
          Find foods you like, check the labels and serving sizes, and make them fit your targets.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
          Read The Label
        </p>
        <h2 className="mt-2 text-xl font-semibold">Check what you drink and what you pour.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Regular soda, juice, sweetened coffee or tea, calorie-containing flavored drinks,
          dressing, mayo, oils, butter, cheese, ketchup, and barbecue sauce can add up fast. Read
          the label. Check the serving size. Measure it when needed.
        </p>
        <p className="mt-3 text-sm leading-relaxed">
          Sugar can appear as cane sugar, high-fructose corn syrup, corn syrup, glucose, dextrose,
          fructose, honey, molasses, syrup, or fruit-juice concentrate. Turn the package over. Check
          calories, total carbohydrate, added sugars, fiber, and serving size.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
          If You Miss
        </p>
        <p className="mt-2 text-base font-semibold leading-relaxed">
          You messed up a meal. Fine. Do not turn one decision into a lost day or a lost weekend. Do
          not punish it by starving tomorrow. Do not wait for Monday. Your next meal is your next
          chance to get back on target. Make the next choice better and keep going.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-muted/35 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">If results stall</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Review labels, portions, drinks, dressings, sauces, serving sizes, calorie-dense foods,
          and consistency before rebuilding the whole diet. This app cannot verify what you ate.
        </p>
      </section>

      <a
        href="https://genxjumps.com/nutrition/"
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 font-semibold transition-colors hover:bg-muted/35"
      >
        <span>
          Learn the basics
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Deeper nutrition explanations and examples on Gen X Jumps.
          </span>
        </span>
        <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      </a>
    </div>
  );
}

function Nutrition() {
  const loadNutrition = useServerFn(getNutritionProfile);
  const saveNutrition = useServerFn(saveNutritionProfile);
  const [result, setResult] = useState<NutritionProfileResult | null>(null);
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [sliderPositions, setSliderPositions] = useState<MealSliderPositions>({});
  const [editing, setEditing] = useState(false);
  const [setupStarted, setSetupStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadNutrition({ data: {} })
      .then((loaded) => {
        if (!active) return;
        setResult(loaded);
        if (loaded.ok && loaded.access === "eligible") {
          if (loaded.profile) {
            setProfile(loaded.profile);
            setForm(profileToForm(loaded.profile));
            setSliderPositions(loaded.profile.sliderPositions);
          } else if (loaded.savedWeight) {
            setForm((current) => ({
              ...current,
              currentWeight: String(loaded.savedWeight?.value ?? ""),
              weightUnit: loaded.savedWeight?.unit ?? "lb",
            }));
          }
        }
      })
      .catch(() => {
        if (active) setResult({ ok: false });
      });
    return () => {
      active = false;
    };
  }, [loadNutrition]);

  async function calculateAndSave() {
    setError(null);
    setStopped(false);
    setMessage(null);
    const candidate = formToIntake(form);
    if (!candidate) {
      setError("Answer every question before calculating your targets.");
      return;
    }
    const parsed = nutritionIntakeSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your answers and try again.");
      return;
    }
    const calculation = calculateNutritionTargets(parsed.data);
    if (!calculation.ok) {
      setStopped(true);
      return;
    }

    const positions =
      profile && sameMealPattern(profile.intake, parsed.data)
        ? sliderPositions
        : recommendedSliderPositions(parsed.data);
    setSaving(true);
    try {
      const saved = await saveNutrition({
        data: { intake: parsed.data, sliderPositions: positions },
      });
      if (!saved.ok) {
        if (saved.reason === "stopped") setStopped(true);
        else setError("Your targets could not be saved. Reload the page and try again.");
        return;
      }
      setProfile(saved.profile);
      setForm(profileToForm(saved.profile));
      setSliderPositions(saved.profile.sliderPositions);
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Your targets could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDaySplit() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveNutrition({
        data: { intake: profile.intake, sliderPositions },
      });
      if (!saved.ok) {
        setMessage("Your day split could not be saved. Try again.");
        return;
      }
      setProfile(saved.profile);
      setSliderPositions(saved.profile.sliderPositions);
      setMessage("Day split saved.");
    } catch {
      setMessage("Your day split could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!result) return <p className="text-sm text-muted-foreground">Loading Your Nutrition...</p>;
  if (!result.ok) {
    return <p className="text-sm text-muted-foreground">Your Nutrition could not be loaded.</p>;
  }
  if (result.access === "locked") {
    return (
      <PlatformPage
        kicker="Your Nutrition"
        title="Available With An Eligible Paid Program"
        description="The free 7-Day Comeback Plan does not unlock the nutrition tool. Your workouts and saved progress are unaffected."
      >
        <Button asChild>
          <Link to="/programs">Explore Programs</Link>
        </Button>
      </PlatformPage>
    );
  }

  return (
    <PlatformPage
      kicker="Your Nutrition"
      title="Calories Matter. Protein First. Meals Stay Simple."
      description="Build starting targets, see how they fit across your normal day, and repeat meals that work. No food logging required."
    >
      {!profile || editing ? (
        !profile && !setupStarted ? (
          <NutritionWelcome onStart={() => setSetupStarted(true)} />
        ) : (
          <SetupForm
            form={form}
            saving={saving}
            error={error}
            stopped={stopped}
            submitLabel={profile ? "Recalculate My Targets" : "Calculate My Targets"}
            onChange={(next) => {
              setForm(next);
              setError(null);
              setStopped(false);
            }}
            onSubmit={() => void calculateAndSave()}
            onCancel={
              profile
                ? () => {
                    setForm(profileToForm(profile));
                    setEditing(false);
                    setError(null);
                    setStopped(false);
                  }
                : undefined
            }
          />
        )
      ) : (
        <NutritionResults
          profile={profile}
          saving={saving}
          message={message}
          sliderPositions={sliderPositions}
          onEdit={() => {
            setEditing(true);
            setError(null);
            setStopped(false);
          }}
          onSliderChange={(occasion, position) => {
            setSliderPositions((current) => ({ ...current, [occasion]: position }));
            setMessage(null);
          }}
          onReset={() => {
            setSliderPositions(recommendedSliderPositions(profile.intake));
            setMessage(null);
          }}
          onSaveSplit={() => void saveDaySplit()}
        />
      )}
    </PlatformPage>
  );
}
