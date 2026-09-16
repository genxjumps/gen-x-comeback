import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getReviewScreen, reviewScreens } from "@/lib/app-review";

const reviewSource = readFileSync(
  new URL("../../components/app-review-screen.tsx", import.meta.url),
  "utf8",
);
const assessmentReviewSource = reviewSource.slice(
  reviewSource.indexOf("function AssessmentReview"),
  reviewSource.indexOf("function AssessmentResultReview"),
);
const welcomeReviewSource = reviewSource.slice(
  reviewSource.indexOf("function WelcomeReview"),
  reviewSource.indexOf("function PlanReadyReview"),
);
const planReadyReviewSource = reviewSource.slice(
  reviewSource.indexOf("function PlanReadyReview"),
  reviewSource.indexOf("const PLAN_REVIEW_DAYS"),
);
const programsReviewSource = reviewSource.slice(
  reviewSource.indexOf("function ProgramsReview"),
  reviewSource.indexOf("function OfferReview"),
);
const acceleratorReviewSource = reviewSource.slice(
  reviewSource.indexOf("function AcceleratorReview"),
  reviewSource.indexOf("function HistoryReview"),
);
const progressReviewSource = reviewSource.slice(
  reviewSource.indexOf("function ProgressReview"),
  reviewSource.indexOf("function NutritionSetupSection"),
);
const nutritionSetupReviewSource = reviewSource.slice(
  reviewSource.indexOf("function NutritionSetupSection"),
  reviewSource.indexOf("function NutritionReview"),
);
const nutritionReviewSource = reviewSource.slice(
  reviewSource.indexOf("function NutritionReview"),
  reviewSource.indexOf("function NotificationsReview"),
);
const activeNutritionReviewSource = nutritionReviewSource.slice(
  nutritionReviewSource.lastIndexOf("  return ("),
);
const assessmentRouteSource = readFileSync(
  new URL("../../routes/assessment.index.tsx", import.meta.url),
  "utf8",
);
const progressRouteSource = readFileSync(
  new URL("../../routes/progress.tsx", import.meta.url),
  "utf8",
);
const nutritionRouteSource = readFileSync(
  new URL("../../routes/nutrition.tsx", import.meta.url),
  "utf8",
);
const setupProgressSource = readFileSync(
  new URL("../../components/setup-progress.tsx", import.meta.url),
  "utf8",
);
const nutritionResultsSource = nutritionRouteSource.slice(
  nutritionRouteSource.indexOf("function NutritionResults"),
  nutritionRouteSource.indexOf("function Nutrition()"),
);
const nutritionSetupRouteSource = nutritionRouteSource.slice(
  nutritionRouteSource.indexOf("function SetupForm"),
  nutritionRouteSource.indexOf("function NutritionResults"),
);
const stylesSource = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

describe("app review catalog", () => {
  it("uses one stable URL for every review state", () => {
    const slugs = reviewScreens.map((screen) => screen.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(getReviewScreen(slug)?.slug).toBe(slug);
  });

  it("covers every customer-facing screen family", () => {
    const routes = new Set(reviewScreens.map((screen) => screen.route));
    expect(routes.size).toBeGreaterThan(0);
    for (const route of [
      "/",
      "/assessment/start",
      "/assessment",
      "/assessment/complete",
      "/welcome",
      "/plan-ready",
      "/home",
      "/your-plan",
      "/your-plan/day/1",
      "/jump-ropes",
      "/my-programs",
      "/programs/accelerator",
      "/checkout/accelerator/success",
      "/my-programs/accelerator/setup",
      "/accelerator",
      "/my-programs/accelerator/runs",
      "/progress",
      "/nutrition",
      "/notifications",
      "/account",
      "/account/purchases",
      "/my-programs/accelerator/refund",
      "/recover",
    ]) {
      expect(routes.has(route)).toBe(true);
    }
  });

  it("keeps all review screens off live account data", () => {
    for (const screen of reviewScreens) {
      expect(screen.slug).not.toContain("@");
      expect(screen.slug).not.toContain("?");
      expect(screen.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("provides a ready-state review URL for every workout video", () => {
    const workoutPreviews = reviewScreens.filter(
      (screen) => screen.kind === "workout" && screen.variant.startsWith("ready-w"),
    );

    expect(workoutPreviews.map((screen) => screen.variant)).toEqual([
      "ready-w01",
      "ready-w02",
      "ready-w03",
      "ready-w04",
      "ready-w05",
      "ready-w06",
      "ready-w07",
    ]);
    expect(workoutPreviews.map((screen) => screen.route)).toEqual(
      Array.from({ length: 7 }, (_, index) => `/your-plan/day/${index + 1}`),
    );
  });

  it("mirrors the real 7-Day intake without changing the separate 28-Day setup", () => {
    expect(assessmentReviewSource).toContain(
      "How many structured workouts did you complete in the past seven days?",
    );
    expect(assessmentReviewSource).toContain("What’s your current jump rope experience?");
    expect(assessmentReviewSource).toContain(
      "Which of these do you regularly have access to for your workouts?",
    );
    expect(assessmentReviewSource).toContain("Current weight");
    expect(assessmentReviewSource).not.toContain("Add your current measurements");
    expect(assessmentReviewSource).not.toContain("Waist");

    const sevenDaySteps = reviewScreens.filter((screen) => screen.kind === "assessment");
    expect(sevenDaySteps).toHaveLength(3);
    expect(sevenDaySteps.every((screen) => screen.route === "/assessment")).toBe(true);
    expect(reviewScreens.some((screen) => screen.route === "/my-programs/accelerator/setup")).toBe(
      true,
    );
  });

  it("applies the approved intake hierarchy to the working 7-Day assessment", () => {
    expect(assessmentRouteSource).toContain(
      "gxj-display-title mt-4 text-3xl uppercase leading-none tracking-wide sm:text-4xl",
    );
    expect(assessmentRouteSource).toContain(
      'className="text-xl font-bold leading-snug sm:text-2xl"',
    );
    expect(assessmentRouteSource).not.toContain(
      '<RadioGroupItem id={`${name}-${o.value}`} value={o.value} className="sr-only" />',
    );
    expect(stylesSource).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(stylesSource).toContain("background-color: var(--color-gxj-mint)");
  });

  it("uses one focused email-access design for both Welcome email states", () => {
    const emailStates = reviewScreens.filter(
      (screen) => screen.slug === "welcome-email-sent" || screen.slug === "welcome-returning",
    );

    expect(emailStates.map((screen) => screen.variant)).toEqual(["sent", "returning"]);
    expect(welcomeReviewSource).toContain('returning ? "Welcome Back" : "Check Your Email"');
    expect(welcomeReviewSource).toContain('returning ? "Send Another Link" : "Open My Email"');
    expect(welcomeReviewSource).toContain("mx-auto max-w-2xl text-center");
    expect(welcomeReviewSource).toContain("relative mx-auto mb-7 h-16 w-20");
    expect(welcomeReviewSource).toContain("size-16 translate-x-2 translate-y-2 text-gxj-orange");
    expect(welcomeReviewSource).not.toContain("place-items-center border-2 border-foreground");
    expect(welcomeReviewSource).toContain(
      "gxj-display-title text-3xl uppercase leading-none tracking-wide sm:text-4xl",
    );
    expect(welcomeReviewSource).toContain(
      "mx-auto max-w-3xl border-t border-foreground/20 pt-5 text-center",
    );
  });

  it("focuses the Home Screen prompt on the install action", () => {
    expect(planReadyReviewSource).toContain("Todd, Keep Your Comeback One Tap Away");
    expect(planReadyReviewSource).toContain("Add to My Home Screen");
    expect(planReadyReviewSource).toContain("min-h-20 w-full justify-between");
    expect(planReadyReviewSource).toContain("rounded-full bg-background text-gxj-orange");
    expect(planReadyReviewSource).toContain("<Download");
    expect(planReadyReviewSource).not.toContain("Plan setup progress");
    expect(planReadyReviewSource).not.toContain('label: "Access saved"');
    expect(planReadyReviewSource).toContain("No app store required.");
    expect(planReadyReviewSource).toContain("Not Now - View My Plan");
  });

  it("gives the Accelerator an aqua identity without mixing in the 7-Day orange accent", () => {
    expect(programsReviewSource).toContain(
      "divide-y-2 divide-foreground border-y-2 border-foreground",
    );
    expect(programsReviewSource).toContain("bg-gxj-aqua text-foreground");
    expect(programsReviewSource).toContain("bg-foreground text-background");
    expect(programsReviewSource).toContain('accelerator ? "28" : "7"');
    expect(programsReviewSource).toContain("Day");
    expect(programsReviewSource).toContain('title: "Fat Loss Accelerator"');
    expect(programsReviewSource).toContain('title: "Comeback Plan"');
    expect(programsReviewSource).not.toContain('title: "28-Day Fat Loss Accelerator"');
    expect(programsReviewSource).not.toContain('title: "7-Day Comeback Plan"');
    expect(programsReviewSource).not.toContain("bg-gxj-aqua-soft");
    expect(programsReviewSource).not.toContain("shadow-[4px_4px_0_var(--color-gxj-aqua)]");
    expect(programsReviewSource).not.toContain("gxj-orange");
    expect(reviewSource).toContain('accent={acceleratorAccent ? "aqua" : "orange"}');
  });

  it("uses the approved app patterns and real program language on the Accelerator review", () => {
    expect(acceleratorReviewSource).toContain('title="Fat Loss Accelerator"');
    expect(acceleratorReviewSource).toContain("8 of 28 Days Complete");
    expect(acceleratorReviewSource).toContain("Workout B - EMOM");
    expect(acceleratorReviewSource).toContain("<WorkoutOverview");
    expect(acceleratorReviewSource).toContain("Jump Rope + Bodyweight");
    expect(acceleratorReviewSource).toContain("Your 28-Day Schedule");
    expect(acceleratorReviewSource).toContain("bg-gxj-aqua");
    expect(acceleratorReviewSource).toContain("<WorkoutLaunchPanel");
    expect(acceleratorReviewSource).toContain("totalDays={28}");
    expect(acceleratorReviewSource).toContain("Day 9 of 28");
    expect(acceleratorReviewSource).toContain("/workout-covers/accelerator-day-09.webp");
    expect(acceleratorReviewSource).toContain('actionLabel="Open Today’s Workout"');
    expect(acceleratorReviewSource).toContain('href="/review/accelerator-workout-day-9"');
    expect(acceleratorReviewSource).toContain('variant === "workout"');
    expect(acceleratorReviewSource).toContain('accent="aqua"');
    expect(acceleratorReviewSource).toContain("acceleratorVideoSrc");
    expect(acceleratorReviewSource).not.toContain("gxj-accelerator-workout-art");
    expect(acceleratorReviewSource).not.toContain("radial-gradient(circle_at_center");
    expect(acceleratorReviewSource).not.toContain("Before You Start");
    expect(acceleratorReviewSource).not.toContain("Dumbbells");
    expect(acceleratorReviewSource).not.toContain("gxj-orange");
  });

  it("uses the approved direct-on-page Progress treatment in review and production", () => {
    expect(progressReviewSource).toContain('titleSize="compact"');
    expect(progressReviewSource).toContain('title="Your Progress"');
    expect(progressReviewSource).not.toContain('kicker="Your Progress"');
    expect(progressReviewSource).toContain("bg-gxj-aqua");
    expect(progressReviewSource).toContain(
      "text-2xl uppercase tracking-wide text-gxj-aqua sm:text-3xl",
    );
    expect(progressReviewSource).not.toContain("text-4xl text-gxj-aqua sm:text-5xl");
    expect(progressReviewSource).toContain("h-3 overflow-hidden bg-foreground/15");
    expect(progressReviewSource).not.toContain("bg-gxj-orange");
    expect(progressRouteSource).toContain('titleSize="compact"');
    expect(progressRouteSource).toContain('title="Your Progress"');
    expect(progressRouteSource).not.toContain('kicker="Progress"');
    expect(progressRouteSource).toContain("border-y-2 border-foreground");
    expect(progressRouteSource).toContain("Latest Measurements");
    expect(progressRouteSource).toContain('currentProgram.accent === "aqua"');
    expect(progressRouteSource).toContain(
      "gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl",
    );
    expect(progressRouteSource).not.toContain("gxj-display-title text-4xl sm:text-5xl");
    expect(progressRouteSource).toContain("h-3 overflow-hidden bg-foreground/15");
    expect(progressRouteSource).not.toContain(
      'className="rounded-lg border border-border bg-card p-5"',
    );
  });

  it("uses the approved direct Nutrition target instruction in review and production", () => {
    const instruction =
      "These are the numbers to follow each day. Hit your calorie and protein targets consistently to lose fat and protect muscle.";
    expect(nutritionReviewSource).toContain(instruction);
    expect(nutritionRouteSource).toContain(instruction);
    expect(nutritionReviewSource).not.toContain(
      "Use these as a starting point, not a pass-or-fail test.",
    );
    expect(activeNutritionReviewSource).toContain('title="Your Nutrition"');
    expect(activeNutritionReviewSource).toContain('titleSize="compact"');
    expect(activeNutritionReviewSource).not.toContain('kicker="Your Nutrition"');
    for (const content of [
      "Starting Targets",
      "Update Targets",
      "Your Normal Day",
      "Adjust Your Day",
      "Build Meals That Work",
      "My Normal Day",
      "Read The Label",
      "If You Miss",
      "If results stall",
      "Learn the basics",
    ]) {
      expect(activeNutritionReviewSource).toContain(content);
      expect(nutritionRouteSource).toContain(content);
    }
    expect(activeNutritionReviewSource).not.toContain('Section title="Build your day"');
    for (const source of [activeNutritionReviewSource, nutritionResultsSource]) {
      expect(source).toContain("border-b border-foreground/15 pb-6 sm:pb-8");
      expect(source).toContain("border-b border-foreground/15 py-6 sm:py-8");
      expect(source).toContain("divide-y divide-foreground/15 border-y");
      expect(
        source.match(/gxj-display-title mt-2 text-2xl uppercase tracking-wide sm:text-3xl/g)
          ?.length,
      ).toBeGreaterThanOrEqual(4);
      expect(source).toContain("gxj-display-title text-xl uppercase tracking-wide sm:text-2xl");
      expect(source).toContain(
        '<h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">',
      );
      expect(source).toContain('<p className="mt-2 text-base font-medium leading-relaxed">');
      expect(source).toContain(
        "These are your numbers for the whole day. Every meal counts. All seven days count.",
      );
      expect(source.match(/text-base leading-relaxed/g)?.length).toBeGreaterThanOrEqual(6);
      expect(source).not.toContain("text-base leading-relaxed text-foreground/80");
      expect(source).toContain("space-y-2 text-base leading-relaxed");
      expect(source).toContain(
        '<p className="gxj-display-title translate-y-1 text-xl uppercase tracking-wide sm:text-2xl">',
      );
      expect(source).toContain("mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4");
      expect(source).toContain(
        "gxj-display-title text-xl uppercase leading-none tracking-wide sm:text-2xl",
      );
      expect(source).toContain(
        "mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground",
      );
      expect(source).not.toContain("mt-3 text-sm leading-relaxed text-muted-foreground");
      expect(source).not.toContain(
        '<section className="rounded-lg border border-border bg-card p-5 sm:p-6">',
      );
      expect(source).not.toContain("border-y-2 border-foreground py-6 sm:py-8");
      expect(source).not.toContain('className="rounded-md border border-border bg-background p-4"');
    }
    expect(activeNutritionReviewSource).not.toContain(
      '<p className="text-sm font-semibold">{percentage}</p>',
    );
    expect(nutritionResultsSource).not.toContain(
      '<p className="text-sm font-semibold">{allocation.percentage}%</p>',
    );
    for (const source of [activeNutritionReviewSource, nutritionRouteSource]) {
      expect(source).toContain(
        "grid grid-cols-2 border-l border-t border-foreground/25 sm:grid-cols-4",
      );
      expect(source).toContain(
        "flex min-h-32 flex-col justify-center border-b border-r border-foreground/25 p-4",
      );
      expect(source).toContain(
        "text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground",
      );
      expect(source).toContain(
        "gxj-display-title mt-3 text-xl uppercase leading-[0.95] tracking-wide sm:text-2xl",
      );
    }
    expect(nutritionRouteSource).toContain('? "Your Nutrition"');
    expect(nutritionRouteSource).toContain('? "Set Up Your Daily Targets"');
    expect(nutritionRouteSource).toContain(
      ': "Calories Matter. Protein First. Meals Stay Simple."',
    );
    expect(nutritionRouteSource).toContain(
      'kicker={profile && !editing ? undefined : setupActive ? undefined : "Nutrition"}',
    );
    expect(nutritionRouteSource).toContain('titleSize="compact"');
    for (const source of [nutritionReviewSource, nutritionRouteSource]) {
      expect(source).toContain('className="mt-2 text-base leading-relaxed"');
    }
  });

  it("exposes the real pre-setup Nutrition entry state for review", () => {
    expect(getReviewScreen("nutrition-entry")?.variant).toBe("welcome");
    for (const source of [nutritionReviewSource, nutritionRouteSource]) {
      expect(source).toContain("Calories Matter. Protein First. Meals Stay Simple.");
      expect(source).toContain("Set Up My Starting Targets");
      expect(source).toContain("No food logging required.");
      expect(source).toContain("Learn the nutrition basics on Gen X Jumps");
      expect(source).toContain("max-w-lg");
      expect(source).not.toContain(
        "The Nutrition tool gives you starting calorie and macro targets",
      );
      expect(source).not.toContain("rounded-lg border border-border bg-card p-5 sm:p-6");
    }
    expect(nutritionReviewSource).toContain('titleSize="compact"');
  });

  it("uses the approved three-step assessment system for Nutrition setup", () => {
    expect(
      reviewScreens.filter(
        (screen) => screen.kind === "nutrition" && screen.variant.startsWith("setup"),
      ),
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
    expect(setupProgressSource).toContain("bg-foreground text-background");
    expect(setupProgressSource).toContain("bg-gxj-orange text-white");
    expect(setupProgressSource).toContain("border-2 border-foreground/20 text-foreground/35");
  });
});
