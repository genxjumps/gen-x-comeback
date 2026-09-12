import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const planHub = source("../../routes/your-plan.index.tsx");

describe("7-Day Plan maintenance actions", () => {
  it("places the plan-change action in the plan navigation before the current workout", () => {
    const navigation = planHub.indexOf('hash="current"');
    const changePlan = planHub.indexOf("Change My Answers");
    const currentWorkout = planHub.indexOf('id="current"');

    expect(changePlan).toBeGreaterThan(navigation);
    expect(changePlan).toBeLessThan(currentWorkout);
  });

  it("uses clear labels for the plan navigation and tips section", () => {
    expect(planHub).toContain("Today");
    expect(planHub).toContain("Plan Tips");
    expect(planHub).toContain("Tips for This Plan");
    expect(planHub).not.toContain(">Guidance<");
    expect(planHub).not.toContain("Plan Guidance");
  });

  it("shows the reset warning only after the plan-change action is opened", () => {
    expect(planHub).toContain("completedCount < TOTAL_ASSIGNMENTS && confirmUpdate");
    expect(planHub).toContain(
      "Changing your answers will rebuild this plan and reset your progress.",
    );
    expect(planHub).toContain("Keep My Plan");
  });

  it("keeps account-access recovery out of the plan content", () => {
    expect(planHub).not.toContain("Resend My Plan Link");
    expect(planHub).not.toContain('href="/recover"');
  });
});
