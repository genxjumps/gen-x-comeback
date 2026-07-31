import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { PlanNav } from "@/components/plan-nav";
import { AccessDenied, readStoredToken } from "@/components/plan-access";
import {
  TOTAL_ASSIGNMENTS,
  assignmentKind,
  currentAssignmentDay,
  type PlanHubData,
} from "@/lib/lead-plan";
import { getPlanHub } from "@/lib/lead.functions";

export const Route = createFileRoute("/your-plan/")({
  head: () => ({
    meta: [
      { title: "My Plan - Your 7-Day Assignments | Gen X Jumps" },
      {
        name: "description",
        content:
          "Your saved 7-day plan hub: the current assignment, your full schedule, your daily protein target, and how to approach the workouts.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "My Plan - Your 7-Day Assignments | Gen X Jumps" },
      {
        property: "og:description",
        content:
          "Your saved 7-day plan hub: the current assignment, your full schedule, and your daily protein target.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanHubPage,
});

const ROW_CLASS = "block p-4 hover:bg-muted/60";

function RowLink({ day, children }: { day: number; children: ReactNode }) {
  if (day === 1) {
    return (
      <Link to="/your-plan/day/1" className={ROW_CLASS}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/your-plan/day/$day" params={{ day: String(day) }} className={ROW_CLASS}>
      {children}
    </Link>
  );
}

function PlanHubPage() {
  const loadHub = useServerFn(getPlanHub);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [hub, setHub] = useState<PlanHubData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = readStoredToken();
    if (!token) {
      setStatus("denied");
      return;
    }
    void (async () => {
      try {
        const result = await loadHub({ data: { token } });
        if (cancelled) return;
        if (result.ok) {
          setHub(result.data);
          setStatus("allowed");
        } else {
          setStatus("denied");
        }
      } catch {
        if (!cancelled) setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHub]);

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <p className="text-sm text-muted-foreground">Loading your plan...</p>
      </div>
    );
  }

  if (status === "denied" || !hub) return <AccessDenied />;

  const completedCount = hub.completedDays.filter((d) =>
    hub.days.some((x) => x.day === d),
  ).length;
  const current = currentAssignmentDay(hub.days, hub.completedDays);
  const currentEntry = current ? hub.days.find((d) => d.day === current) : null;
  const pct = Math.round((completedCount / TOTAL_ASSIGNMENTS) * 100);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 pb-28 sm:py-14 sm:pb-28">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Your Plan
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {hub.firstName}, Here&rsquo;s What To Do Next
      </h1>
      <p className="mt-3 text-sm font-medium">
        {completedCount} of {TOTAL_ASSIGNMENTS} assignments complete
      </p>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL_ASSIGNMENTS}
        aria-valuenow={completedCount}
        aria-label="Plan progress"
      >
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>

      {/* Current assignment */}
      <section id="current" className="mt-8 scroll-mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Current Assignment
        </h2>
        {currentEntry ? (
          <>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Day {currentEntry.day} &middot; {assignmentKind(currentEntry)}
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">{currentEntry.title}</h3>
            {currentEntry.minutes ? (
              <p className="mt-1 text-xs text-muted-foreground">About {currentEntry.minutes} minutes</p>
            ) : null}
            {currentEntry.description ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {currentEntry.description}
              </p>
            ) : null}
            {currentEntry.optional ? (
              <div className="mt-3 rounded-md border border-dashed border-border p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Optional Active Recovery
                </p>
                <p className="mt-1 text-sm font-medium">{currentEntry.optional.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {currentEntry.optional.description}
                </p>
              </div>
            ) : null}
            {currentEntry.day === 1 ? (
              <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
                <Link to="/your-plan/day/1">Start Day 1</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
                <Link to="/your-plan/day/$day" params={{ day: String(currentEntry.day) }}>
                  Open Day {currentEntry.day} Details
                </Link>
              </Button>
            )}
          </>
        ) : (
          <>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">Plan Complete</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You finished all seven assignments in this plan. Review any day below whenever you
              want.
            </p>
          </>
        )}
      </section>

      {/* Schedule */}
      <section id="schedule" className="mt-8 scroll-mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Your 7-Day Schedule</h2>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {hub.days.map((d) => {
            const complete = hub.completedDays.includes(d.day);
            const isCurrent = d.day === current;
            const status = complete ? "Complete" : isCurrent ? "Current" : "Upcoming";
            return (
              <li key={d.day} className={isCurrent ? "bg-card" : "bg-muted/30"}>
                <RowLink day={d.day}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      Day {d.day}: {d.title}
                    </h3>
                    <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {status}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {assignmentKind(d)}
                  </p>
                  {d.description ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {d.description}
                    </p>
                  ) : null}
                  {d.minutes ? (
                    <p className="mt-2 text-xs text-muted-foreground">About {d.minutes} minutes</p>
                  ) : null}
                  {d.optional ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Optional Active Recovery available: {d.optional.title}
                    </p>
                  ) : null}
                </RowLink>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Guidance */}
      <section id="guidance" className="mt-8 scroll-mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Plan Guidance</h2>

        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Your Daily Protein Target
          </h3>
          {hub.protein.grams !== null ? (
            <>
              <p className="mt-1.5 text-lg font-semibold tracking-tight">
                Aim for {hub.protein.grams} grams per day
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Based on the weight you provided, this target is designed to support fat loss,
                preserve muscle, and improve recovery.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-sm font-medium leading-relaxed">
                Aim for about 1 gram of protein per pound of current bodyweight each day. If you use
                kilograms, multiply your weight by 2.2.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A simple way to get there is to build three or four meals or eating times around a
                solid protein source. Aim for roughly 30-40 grams each time, then adjust based on
                your bodyweight target.
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed">
                Protein first. Before you build the rest of the meal, decide where the protein is
                coming from.
              </p>
            </>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            How to Approach the Workouts
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            These workouts are supposed to challenge you. Work hard. Rest when needed. Do fewer reps
            or use a smaller range of motion when necessary. Skip a movement you cannot perform
            safely. Stop if you feel pain rather than normal exercise discomfort.
          </p>
        </div>

        <div className="mt-4">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/assessment/start">Update My Plan</Link>
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Changing your answers rebuilds this plan and resets its progress.
          </p>
        </div>
      </section>

      <PlanNav />
    </div>
  );
}
