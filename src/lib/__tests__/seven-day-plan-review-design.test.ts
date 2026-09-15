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

  it("keeps the day number visible in every schedule state", () => {
    expect(reviewSource).toContain("{`0${day}`}");
    expect(reviewSource).not.toContain(
      'finished ? <Check className="size-4" aria-hidden="true" /> : `0${day}`',
    );
    expect(reviewSource).toContain('finished ? "rounded-full bg-foreground text-background"');
    expect(reviewSource).toContain('current ? "rounded-[2px] bg-gxj-orange text-white"');
    expect(reviewSource).toContain(
      'stateLabel = finished ? "Complete" : current ? "Today" : "Upcoming"',
    );
  });
});
