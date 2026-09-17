import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SevenDayScheduleRow } from "../../components/seven-day-schedule-row";

const reviewSource = readFileSync(
  new URL("../../components/app-review-screen.tsx", import.meta.url),
  "utf8",
);
const planSource = readFileSync(
  new URL("../../routes/your-plan.index.tsx", import.meta.url),
  "utf8",
);
const launchSource = readFileSync(
  new URL("../../components/workout-launch-panel.tsx", import.meta.url),
  "utf8",
);

describe("7-Day plan review design", () => {
  it("reuses the Home workout launch panel on the active plan", () => {
    expect(launchSource).toContain("export function WorkoutLaunchPanel");
    expect(reviewSource.match(/<WorkoutLaunchPanel/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("uses the approved hierarchy without wrapping the schedule in a card", () => {
    expect(reviewSource).toContain("Your 7-Day Schedule");
    expect(reviewSource).toContain("Your Plan Details");
    expect(reviewSource).toContain("divide-y divide-foreground/15 border-t-2 border-foreground");
    expect(reviewSource).not.toContain('<Section title="Schedule">');
  });

  it("keeps the day number visible in every schedule state", () => {
    const completed = renderToStaticMarkup(
      createElement(SevenDayScheduleRow, {
        day: 1,
        title: "Jump Rope + Full Body",
        state: "completed",
        stateLabel: "Complete",
      }),
    );
    const current = renderToStaticMarkup(
      createElement(SevenDayScheduleRow, {
        day: 3,
        title: "Recovery",
        state: "current",
        stateLabel: "Today",
      }),
    );
    const upcoming = renderToStaticMarkup(
      createElement(SevenDayScheduleRow, {
        day: 7,
        title: "Rest",
        state: "upcoming",
        stateLabel: "Upcoming",
      }),
    );

    expect(completed).toContain("text-foreground/45");
    expect(completed).toContain(">01<");
    expect(completed).not.toContain("rounded-full bg-foreground");
    expect(current).toContain("bg-gxj-mint");
    expect(current).toContain("bg-gxj-orange");
    expect(current).toContain(">03<");
    expect(upcoming).toContain("text-foreground");
    expect(upcoming).toContain(">07<");
    expect(upcoming).not.toContain("text-foreground/45");
  });

  it("uses the same state component for every saved production-plan day", () => {
    expect(planSource).toContain("hub.days.map");
    expect(planSource).toContain("<SevenDayScheduleRow");
    expect(planSource).toContain("const rowState: SevenDayScheduleState = complete");
    expect(planSource).toContain('? "completed"');
    expect(planSource).toContain('? "current"');
    expect(planSource).not.toContain("Day {d.day}: {d.title}");
  });
});
