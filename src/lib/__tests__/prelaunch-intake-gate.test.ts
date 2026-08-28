import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const leadFunctions = source("../lead.functions.ts");
const home = source("../../routes/index.tsx");
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
      saveHandler.indexOf('rpc("commit_plan_version"'),
    );
  });

  it("blocks every public entry surface without blocking existing-plan actions", () => {
    expect(home).toContain("!NEW_PLAN_INTAKE_OPEN && !hasPlan");
    expect(start).toContain("if (!NEW_PLAN_INTAKE_OPEN)");
    expect(assessment).toContain("if (!NEW_PLAN_INTAKE_OPEN)");
    expect(complete).toContain("!NEW_PLAN_INTAKE_OPEN");
    expect(leadFunctions).not.toContain(
      "export const regeneratePlanWithToken = NEW_PLAN_INTAKE_OPEN",
    );
  });

  it("keeps recovery available to existing participants", () => {
    expect(closed).toContain('<Link to="/recover">Recover My Plan</Link>');
  });
});
