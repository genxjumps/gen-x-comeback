import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const leadFunctions = source("../lead.functions.ts");
const handoffRoute = source("../../routes/intake.7-day.ts");
const root = source("../../routes/__root.tsx");
const home = source("../../routes/index.tsx");
const signup = source("../../routes/start.7-day.tsx");
const start = source("../../routes/assessment.start.tsx");
const assessment = source("../../routes/assessment.index.tsx");
const complete = source("../../routes/assessment.complete.tsx");
const closed = source("../../components/intake-closed.tsx");

describe("pre-launch intake gate", () => {
  it("defaults new-plan intake to closed", () => {
    expect(NEW_PLAN_INTAKE_OPEN).toBe(false);
  });

  it("fails closed on the server before the lead-plan transaction", () => {
    const saveStart = leadFunctions.indexOf("export const saveLeadPlan");
    const saveEnd = leadFunctions.indexOf("export const regeneratePlanWithToken", saveStart);
    const saveHandler = leadFunctions.slice(saveStart, saveEnd);

    expect(saveHandler).toContain("if (!NEW_PLAN_INTAKE_OPEN)");
    expect(saveHandler.indexOf("if (!NEW_PLAN_INTAKE_OPEN)")).toBeLessThan(
      saveHandler.indexOf("commitNewPlan(data"),
    );

    expect(handoffRoute).toContain("controlledTestLeadIntakeAllowed(parsed.data.email, request)");
    expect(handoffRoute.indexOf("if (!NEW_PLAN_INTAKE_OPEN)")).toBeLessThan(
      handoffRoute.indexOf("const intake = await createWebsiteLeadIntake("),
    );
  });

  it("blocks every public entry surface without blocking existing-plan actions", () => {
    expect(home).toContain("!NEW_PLAN_INTAKE_OPEN && !hasPlan");
    expect(signup).toContain("NEW_PLAN_INTAKE_OPEN ? (");
    expect(start).toContain('if (intakeAccess === "closed")');
    expect(assessment).toContain('if (intakeAccess === "closed")');
    expect(complete).toContain("!NEW_PLAN_INTAKE_OPEN");
    expect(leadFunctions).not.toContain(
      "export const regeneratePlanWithToken = NEW_PLAN_INTAKE_OPEN",
    );
  });

  it("keeps recovery available to existing participants", () => {
    expect(closed).toContain('<Link to="/recover">Recover My Plan</Link>');
  });

  it("uses the approved public offer treatment while intake is closed", () => {
    expect(closed).toContain("Prove You&rsquo;re Not Done Yet");
    expect(closed).toContain("text-5xl");
    expect(closed).toContain("sm:text-7xl");
    expect(closed).toContain("Opening Soon");
    expect(closed).toContain("isn&rsquo;t available to new participants yet.");
    expect(closed).toContain("Built for a real comeback");
    expect(closed).toContain("Short workouts");
    expect(closed).toContain("Simple food targets");
    expect(closed).toContain("Options for your joints");
    expect(closed).toContain("min-h-14");
    expect(closed).toContain('variant="outline"');
    expect(closed).not.toContain("rounded-lg border border-border bg-card");
    expect(closed).not.toContain('to="/">Back to Start</Link>');
    expect(root).toContain("gxj-platform-shell flex min-h-screen");
    expect(root).toContain("gxj-app-surface flex-1");
  });

  it("lets a valid controlled-test handoff finish while direct intake stays closed", () => {
    expect(start).toContain("useNewPlanIntakeAccess");
    expect(assessment).toContain("useNewPlanIntakeAccess");
    expect(complete).toContain('handoffStatus === "available"');

    const handoffSaveStart = leadFunctions.indexOf("export const saveLeadPlanFromHandoff");
    const handoffSaveEnd = leadFunctions.indexOf(
      "export const recordOnboardingEvent",
      handoffSaveStart,
    );
    const handoffSaveHandler = leadFunctions.slice(handoffSaveStart, handoffSaveEnd);
    expect(handoffSaveHandler).toContain('"save_signup_plan"');
    expect(handoffSaveHandler).not.toContain('throw new Error("New plan intake is closed")');
  });
});
