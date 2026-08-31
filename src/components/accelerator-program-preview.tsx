import { useMemo, useState } from "react";
import { ArrowRight, Check, LockKeyhole, Play, Utensils, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ACCELERATOR_ASSIGNMENTS,
  ACCELERATOR_DAYS,
  ACCELERATOR_EQUIPMENT,
  ACCELERATOR_WEEK_FOCUS,
  acceleratorDayAccess,
  type AcceleratorDay,
  type AcceleratorWeek,
} from "@/lib/accelerator/program";

const PREVIEW_STATES = [
  { label: "Day 1", completed: 0 },
  { label: "Week 2", completed: 7 },
  { label: "Week 3", completed: 14 },
  { label: "Week 4", completed: 21 },
  { label: "Finished", completed: 28 },
] as const;

function assignmentLabel(day: AcceleratorDay): string {
  return ACCELERATOR_ASSIGNMENTS[day.assignment].label;
}

function DayStatusIcon({ access }: { access: "completed" | "current" | "locked" }) {
  if (access === "completed") return <Check aria-hidden="true" className="size-3.5" />;
  if (access === "locked") return <LockKeyhole aria-hidden="true" className="size-3.5" />;
  return <Play aria-hidden="true" className="size-3.5" />;
}

function MediaPlaceholder({ day }: { day: AcceleratorDay }) {
  if (day.kind === "rest") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 px-6 text-center">
        <p className="text-sm font-semibold">No workout video today</p>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Rest-day guidance will live here. The participant still acknowledges the day before
          advancing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 px-6 text-center">
      <Video aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-semibold">{assignmentLabel(day)} video placeholder</p>
      <p className="mt-1 text-xs text-muted-foreground">Cloudflare Stream ID pending</p>
    </div>
  );
}

export function AcceleratorProgramPreview({ initialCompleted = 0 }: { initialCompleted?: number }) {
  const [completedCount, setCompletedCount] = useState(initialCompleted);
  const [displayWeek, setDisplayWeek] = useState<AcceleratorWeek>(
    initialCompleted >= 28 ? 4 : ((Math.floor(initialCompleted / 7) + 1) as AcceleratorWeek),
  );

  const daysWithAccess = useMemo(
    () =>
      acceleratorDayAccess(
        new Set(Array.from({ length: completedCount }, (_, index) => index + 1)),
      ),
    [completedCount],
  );
  const currentDay = daysWithAccess.find((day) => day.access === "current") ?? null;
  const displayedDays = daysWithAccess.filter((day) => day.week === displayWeek);
  const progressPercent = Math.round((completedCount / ACCELERATOR_DAYS.length) * 100);
  const focus = ACCELERATOR_WEEK_FOCUS.find(({ week }) => week === displayWeek)!;

  function selectPreviewState(completed: number) {
    setCompletedCount(completed);
    setDisplayWeek(completed >= 28 ? 4 : ((Math.floor(completed / 7) + 1) as AcceleratorWeek));
  }

  function completeCurrentDay() {
    if (!currentDay) return;
    const nextCompleted = currentDay.day;
    setCompletedCount(nextCompleted);
    setDisplayWeek(
      nextCompleted >= 28 ? 4 : ((Math.floor(nextCompleted / 7) + 1) as AcceleratorWeek),
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <section className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Internal layout preview
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Change the simulated progress to inspect each program state. Nothing is saved.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PREVIEW_STATES.map((state) => (
            <Button
              key={state.label}
              type="button"
              size="sm"
              variant={completedCount === state.completed ? "default" : "outline"}
              onClick={() => selectPreviewState(state.completed)}
            >
              {state.label}
            </Button>
          ))}
        </div>
      </section>

      <header className="mt-8">
        <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
          28-Day Fat Loss Accelerator
        </p>
        <div className="mt-3 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="gxj-display-title text-3xl leading-tight tracking-tight sm:text-4xl">
              {currentDay
                ? `Day ${currentDay.day}: ${assignmentLabel(currentDay)}`
                : "Accelerator Complete"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {currentDay
                ? "Do the assigned day, mark it complete, and the next day unlocks. Missed time never skips your place."
                : "All 28 days are complete. Review your optional final results or choose what comes next."}
            </p>
          </div>
          <p className="text-sm font-semibold">{completedCount} of 28 days complete</p>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-[2px] bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={28}
          aria-valuenow={completedCount}
          aria-label="Accelerator progress"
        >
          <div className="h-full bg-gxj-teal" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div>
          {currentDay ? (
            <section aria-labelledby="today-title">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
                    Today&rsquo;s assignment
                  </p>
                  <h2 id="today-title" className="mt-1 text-xl font-semibold tracking-tight">
                    {assignmentLabel(currentDay)}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentDay.kind === "primary_workout"
                    ? "Runtime pending"
                    : currentDay.kind === "active_recovery"
                      ? "Video optional"
                      : "Recovery"}
                </p>
              </div>

              <div className="mt-4">
                <MediaPlaceholder day={currentDay} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Equipment
                  </h3>
                  <p className="mt-2 text-sm font-semibold">
                    {currentDay.kind === "rest" ? "None" : ACCELERATOR_EQUIPMENT.program}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    No dumbbells, bench, or gym equipment required. Final video-by-video audit is
                    still required before launch.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Today&rsquo;s focus
                  </h3>
                  <p className="mt-2 text-sm font-semibold">
                    {ACCELERATOR_ASSIGNMENTS[currentDay.assignment].focus}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Week {currentDay.week}: {ACCELERATOR_WEEK_FOCUS[currentDay.week - 1].title}
                  </p>
                </div>
              </div>

              <Button type="button" size="lg" className="mt-4 w-full" onClick={completeCurrentDay}>
                {currentDay.kind === "primary_workout"
                  ? `Mark Day ${currentDay.day} Complete`
                  : `Acknowledge Day ${currentDay.day}`}
              </Button>
            </section>
          ) : (
            <section className="rounded-lg border border-border bg-gxj-mint p-6">
              <div className="flex size-10 items-center justify-center rounded-full bg-gxj-teal text-white">
                <Check aria-hidden="true" className="size-5" />
              </div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
                Program complete
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                You Completed All 28 Days
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                That is the full Accelerator - one day at a time, all the way through.
              </p>
              <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["Final progress", "28 of 28 days"],
                  ["Weight change", "Down 6 lb"],
                  ["Waist change", "Down 1.5 in"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-background/80 p-4">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 rounded-lg border border-border bg-background/80 p-4">
                <h3 className="font-semibold">Optional Final Measurements</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add either one, both, or skip them. Your program is already complete.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button type="button">
                  Start Another Run
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
                <Button type="button" variant="outline">
                  Explore Other Programs
                </Button>
              </div>
            </section>
          )}

          <section className="mt-10" aria-labelledby="schedule-title">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
                Four-week schedule
              </p>
              <h2 id="schedule-title" className="mt-1 text-xl font-semibold tracking-tight">
                Week {displayWeek}: {focus.title}
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCELERATOR_WEEK_FOCUS.map((week) => (
                <Button
                  key={week.week}
                  type="button"
                  variant={displayWeek === week.week ? "default" : "outline"}
                  onClick={() => setDisplayWeek(week.week)}
                >
                  Week {week.week}
                </Button>
              ))}
            </div>

            <ol className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {displayedDays.map((day) => (
                <li key={day.day} className={day.access === "current" ? "bg-gxj-mint" : "bg-card"}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                        day.access === "current"
                          ? "border-gxj-teal bg-gxj-teal text-white"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <DayStatusIcon access={day.access} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        Day {day.day}: {assignmentLabel(day)}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {day.access}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <Video aria-hidden="true" className="size-5 text-gxj-teal" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Week {currentDay?.week ?? 4} coaching
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {ACCELERATOR_WEEK_FOCUS[(currentDay?.week ?? 4) - 1].title}
            </h2>
            <div className="mt-3 flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/60 px-4 text-center">
              <p className="text-xs text-muted-foreground">Weekly coaching video placeholder</p>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Your Measurements
            </p>
            <p className="mt-2 text-sm font-semibold">Make progress visible</p>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">Weight</dt>
                <dd className="mt-1 text-sm font-semibold">Not recorded</dd>
              </div>
              <div className="rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">Waist</dt>
                <dd className="mt-1 text-sm font-semibold">Not recorded</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Add weight, waist, both, or neither. Each measurement keeps its own history. Nothing
              is saved in this layout preview.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <Utensils aria-hidden="true" className="size-5 text-gxj-teal" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Your Nutrition Targets
            </p>
            <dl className="mt-3 space-y-3">
              <div className="rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">Daily calories</dt>
                <dd className="mt-1 text-sm font-semibold">Formula pending</dd>
              </div>
              <div className="rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">Daily protein</dt>
                <dd className="mt-1 text-sm font-semibold">Formula pending</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The targets and nutrition framework will be added after the approved calculation is
              locked and tested.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              What Progress Looks Like
            </p>
            <p className="mt-2 text-sm font-semibold">Focus on execution, not variety.</p>
            <ul className="mt-3 grid gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>Fewer rope trips</li>
              <li>Smoother movement</li>
              <li>More reps in the same time</li>
              <li>A stronger pace</li>
              <li>Better control</li>
              <li>Weight and fat-loss progress over time</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
