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
const assessmentRouteSource = readFileSync(
  new URL("../../routes/assessment.index.tsx", import.meta.url),
  "utf8",
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
    expect(programsReviewSource).toContain('accelerator ? "28" : "07"');
    expect(programsReviewSource).not.toContain("bg-gxj-aqua-soft");
    expect(programsReviewSource).not.toContain("shadow-[4px_4px_0_var(--color-gxj-aqua)]");
    expect(programsReviewSource).not.toContain("gxj-orange");
    expect(reviewSource).toContain('accent={acceleratorAccent ? "aqua" : "orange"}');
  });
});
