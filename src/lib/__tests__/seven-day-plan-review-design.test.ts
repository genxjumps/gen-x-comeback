import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reviewSource = readFileSync(
  new URL("../../components/app-review-screen.tsx", import.meta.url),
  "utf8",
);

describe("7-Day plan review design", () => {
  it("reuses the Home workout launch panel on the active plan", () => {
    expect(reviewSource).toContain("function WorkoutLaunchPanel");
    expect(reviewSource.match(/<WorkoutLaunchPanel/g)).toHaveLength(2);
  });

  it("uses the approved hierarchy without wrapping the schedule in a card", () => {
    expect(reviewSource).toContain("Your 7-Day Schedule");
    expect(reviewSource).toContain("Your Plan Details");
    expect(reviewSource).toContain("divide-y divide-foreground/15 border-t-2 border-foreground");
    expect(reviewSource).not.toContain('<Section title="Schedule">');
  });
});
