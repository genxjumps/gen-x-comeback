import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { APP_REVIEW_SCENARIOS, getReviewScenario, getReviewScenarioUrl } from "@/lib/app-review";
import { ACCELERATOR_WORKOUTS } from "@/lib/accelerator/program";

const reviewSource = readFileSync(
  new URL("../../components/app-review-screen.tsx", import.meta.url),
  "utf8",
);
const reviewShellSource = readFileSync(
  new URL("../../components/review-shell.tsx", import.meta.url),
  "utf8",
);
const homeSource = readFileSync(new URL("../../routes/home.tsx", import.meta.url), "utf8");
const yourPlanSource = readFileSync(
  new URL("../../routes/your-plan.index.tsx", import.meta.url),
  "utf8",
);
const assessmentSource = readFileSync(
  new URL("../../routes/assessment.index.tsx", import.meta.url),
  "utf8",
);
const planReadySource = readFileSync(
  new URL("../../routes/plan-ready.tsx", import.meta.url),
  "utf8",
);
const progressSource = readFileSync(new URL("../../routes/progress.tsx", import.meta.url), "utf8");
const nutritionRouteSource = readFileSync(
  new URL("../../routes/nutrition.tsx", import.meta.url),
  "utf8",
);
const setupProgressSource = readFileSync(
  new URL("../../components/setup-progress.tsx", import.meta.url),
  "utf8",
);
const nutritionSetupRouteSource = readFileSync(
  new URL("../../components/nutrition-setup.tsx", import.meta.url),
  "utf8",
);
const nutritionSetupReviewSource = readFileSync(
  new URL("../../components/nutrition-setup-review.tsx", import.meta.url),
  "utf8",
);
const acceleratorOfferSource = readFileSync(
  new URL("../../components/accelerator-offer-page.tsx", import.meta.url),
  "utf8",
);

describe("app review catalog", () => {
  it("uses one stable URL for every review state", () => {
    for (const scenario of APP_REVIEW_SCENARIOS) {
      const url = getReviewScenarioUrl(scenario.id);
      expect(url).toBe(`/review/${scenario.id}`);
      expect(getReviewScenario(scenario.id)?.id).toBe(scenario.id);
    }
  });

  it("covers every customer-facing screen family", () => {
    const families = new Set(APP_REVIEW_SCENARIOS.map((scenario) => scenario.family));
    expect(families).toEqual(
      new Set([
        "Public",
        "Assessment",
        "Plan",
        "Programs",
        "Workout",
        "Progress",
        "Nutrition",
        "Account",
        "Notifications",
        "Recovery",
        "Checkout",
      ]),
    );
  });

  it("keeps all review screens off live account data", () => {
    expect(reviewSource).not.toContain("useServerFn");
    expect(reviewSource).not.toContain("supabase");
    expect(reviewSource).not.toContain("getCurrentCustomer");
    expect(reviewSource).not.toContain("getHomeSnapshot");
  });

  it("presents the free plan as a complete conversion page", () => {
    expect(reviewSource).toContain("Free Personalized 7-Day Fitness Plan for Adults 50+");
    expect(reviewSource).toContain("Build My Free Plan");
    expect(reviewSource).toContain("What You Get");
    expect(reviewSource).toContain("How It Works");
    expect(reviewSource).toContain("Built for people who want to start where they are");
  });

  it("provides a ready-state review URL for every workout video", () => {
    for (const workout of ACCELERATOR_WORKOUTS) {
      const expectedId = `accelerator-workout-day-${workout.day}-ready`;
      expect(getReviewScenario(expectedId)?.id).toBe(expectedId);
    }
  });

  it("mirrors the real 7-Day intake without changing the separate 28-Day setup", () => {
    expect(reviewSource).toContain("How active are you right now?");
    expect(reviewSource).toContain("How many days can you realistically train?");
    expect(reviewSource).toContain("What equipment do you have?");
    expect(reviewSource).toContain("Anything we should know before we build your plan?");
  });

  it("applies the approved intake hierarchy to the working 7-Day assessment", () => {
    expect(assessmentSource).toContain("gxj-assessment-options");
    expect(assessmentSource).toContain("gxj-option-card");
    expect(assessmentSource).toContain("gxj-assessment-weight");
    expect(assessmentSource).toContain("gxj-assessment-unit");
  });

  it("uses one focused email-access design for both Welcome email states", () => {
    expect(reviewSource).toContain("Check your email");
    expect(reviewSource).toContain("Open My Plan");
  });

  it("focuses the Home Screen prompt on the install action", () => {
    expect(reviewSource).toContain("Add Gen X Jumps to your Home Screen");
  });

  it("gives the Accelerator an aqua identity without mixing in the 7-Day orange accent", () => {
    expect(reviewSource).toContain("gxj-aqua");
  });

  it("uses the approved app patterns and real program language on the Accelerator review", () => {
    expect(reviewSource).toContain("28-Day Fat Loss Accelerator");
    expect(reviewSource).toContain("Owned for life");
  });

  it("uses one accurate sales page for the Accelerator route and review", () => {
    expect(acceleratorOfferSource).toContain("28-Day Fat Loss Accelerator");
  });

  it("uses the approved direct-on-page Progress treatment in review and production", () => {
    expect(reviewSource).toContain("Your Progress");
    expect(progressSource).toContain("Your Progress");
  });

  it("uses the approved direct Nutrition target instruction in review and production", () => {
    expect(reviewSource).toContain("Your Nutrition");
    expect(nutritionRouteSource).toContain("Your Nutrition");
  });

  it("exposes the real pre-setup Nutrition entry state for review", () => {
    expect(reviewSource).toContain("Nutrition setup");
  });

  it("centers only the Nutrition locked-status block", () => {
    expect(reviewSource).toContain("Nutrition not unlocked");
  });

  it("explains the Nutrition unavailable state and gives both recovery steps", () => {
    expect(reviewSource).toContain("Nutrition unavailable");
  });

  it("uses the approved three-step assessment system for Nutrition setup", () => {
    expect(
      APP_REVIEW_SCENARIOS.filter((scenario) => scenario.id.startsWith("nutrition-setup-step-")),
    ).toHaveLength(3);
    for (const source of [nutritionSetupReviewSource, nutritionSetupRouteSource]) {
      expect(source).toContain("What is your current fitness goal?");
      expect(source).toContain("What do you want your body weight to do?");
      expect(source).toContain("Your starting numbers");
      expect(source).toContain("Outside of workouts, how active is your typical day?");
      expect(source).toContain("How are you training right now?");
      expect(source).toContain("On a typical weekday, which of these eating occasions do you use?");
      expect(source).toContain("Which meal tends to be your biggest?");
      expect(source).toContain("Your answers are saved as you go.");
      expect(source).not.toContain("rounded-lg border border-border bg-card");
    }
    expect(nutritionSetupReviewSource).toContain("border-t-2 border-foreground/20 py-6 sm:py-8");
    expect(nutritionRouteSource).toContain("border-t-2 border-foreground/20 py-6 sm:py-8");
    expect(nutritionSetupReviewSource).toContain("Nutrition setup progress");
    expect(nutritionSetupRouteSource).toContain(
      'step === 3 ? (saving ? "Saving..." : submitLabel) : "Continue"',
    );
    expect(nutritionRouteSource).toContain(
      '<SetupProgress currentStep={setupStep} label="Nutrition setup progress" />',
    );
    expect(setupProgressSource).toContain("bg-[var(--pu-text-primary)]");
    expect(setupProgressSource).toContain("bg-[var(--pu-action-primary)]");
    expect(setupProgressSource).toContain("bg-[var(--pu-surface-subtle)]");
    expect(setupProgressSource).toContain('role="progressbar"');
  });
});
