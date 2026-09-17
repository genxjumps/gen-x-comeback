import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const reviewScreen = source("../../components/app-review-screen.tsx");
const reviewShell = source("../../components/review-shell.tsx");
const platformShell = source("../../components/platform-shell.tsx");
const reviewHub = source("../../routes/review.tsx");

describe("review catalog production-system guardrail", () => {
  it("uses the same governed shell style source as the participant app", () => {
    expect(platformShell).toContain("platformShellStyles as shell");
    expect(reviewShell).toContain("platformShellStyles as shell");
    expect(reviewShell).not.toContain("after:bg-gxj-orange");
    expect(reviewShell).not.toContain("after:bg-gxj-aqua");
  });

  it("delegates review helper controls to production Precision Utility primitives", () => {
    const start = reviewScreen.indexOf("function Section(");
    const end = reviewScreen.indexOf("function Page(", start);
    const helpers = reviewScreen.slice(start, end);

    expect(helpers).toContain("<PuSection");
    expect(helpers).toContain("<PuHeading");
    expect(helpers).toContain("<PuEyebrow");
    expect(helpers).toContain("<PuRadioChoice");
    expect(helpers).toContain("<PuCheckboxChoice");
    expect(helpers).toContain('<Button type="button"');
    expect(helpers).not.toContain("gxj-display-title");
    expect(helpers).not.toContain("border-gxj-orange bg-gxj-mint");
  });

  it("states that live production routes remain the visual authority", () => {
    expect(reviewHub).toContain("Production routes remain the");
    expect(reviewHub).toContain(
      "visual authority; review shares the production shell and control primitives",
    );
  });
});
