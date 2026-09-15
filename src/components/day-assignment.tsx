import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/plan-access";
import { WorkoutMediaCard } from "@/components/workout-media-card";
import { WorkoutScreen } from "@/components/workout-screen";
import { readStoredToken } from "@/lib/access-token";
import {
  assignmentType,
  cardioGuidance,
  completionLabel,
  movementDuration,
  planDayHeading,
  planDayTiming,
  planWeekday,
  type CardioContext,
  type PlanCalendar,
  type PlanDayView,
} from "@/lib/lead-plan";
import { completePlanDay, getDayBrief } from "@/lib/lead.functions";
import { W01_APPROACH, W01_CARDIO_HEADING } from "@/lib/w01-content";
import { sevenDayWorkoutOverview, sevenDayWorkoutRuntime } from "@/lib/workout-presentation";

type Brief = {
  cardio: CardioContext;
  completedDays: number[];
  tier: string;
  day: PlanDayView | null;
  calendar: PlanCalendar;
};

/**
 * Protected assignment page for Days 2 through 7. Everything rendered comes
 * from the saved plan on the server; the local assessment draft is never used.
 */
export function DayAssignment({ dayNumber }: { dayNumber: number }) {
  const loadBrief = useServerFn(getDayBrief);
  const completeDay = useServerFn(completePlanDay);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    setBrief(null);
    // A missing local token is still valid: an authorized return-link session
    // cookie from the emailed link can carry access on another browser.
    const stored = readStoredToken();
    void (async () => {
      try {
        const result = await loadBrief({ data: { token: stored, day: dayNumber } });
        if (cancelled) return;
        if (result.ok) {
          setBrief({
            cardio: result.cardio,
            completedDays: result.completedDays,
            tier: result.tier,
            day: result.day,
            calendar: result.calendar,
          });
          setToken(stored);
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
  }, [loadBrief, dayNumber]);

  const completed = brief ? brief.completedDays.includes(dayNumber) : false;
  const priorDone = brief
    ? Array.from({ length: dayNumber - 1 }, (_, i) => i + 1).every((d) =>
        brief.completedDays.includes(d),
      )
    : false;
  const timing = brief ? planDayTiming(brief.calendar, dayNumber) : null;
  const dayAvailable = completed || (priorDone && timing?.available === true);

  async function markComplete() {
    if (status !== "allowed" || marking || completed || !dayAvailable) return;
    setMarking(true);
    setMarkError(null);
    try {
      const result = await completeDay({ data: { token, day: dayNumber } });
      if (result.ok) {
        setBrief((prev) => (prev ? { ...prev, completedDays: result.completedDays } : prev));
      } else {
        setMarkError(
          "We could not confirm your access or your earlier day completions. Reload and retry.",
        );
      }
    } catch {
      setMarkError("We could not save that. Try again.");
    } finally {
      setMarking(false);
    }
  }

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <p className="text-sm text-muted-foreground">Checking your access...</p>
      </div>
    );
  }

  if (status === "denied" || !brief) return <AccessDenied />;

  const day = brief.day;
  const kind = assignmentType(day);
  const title = day?.title ?? "Workout";
  const optional = day?.optional ?? null;
  const timingHeading = timing ? planDayHeading(day, timing) : "Upcoming";
  const mediaState = completed
    ? ({ type: "completed" } as const)
    : !priorDone
      ? ({
          type: "blocked",
          previousDay: dayNumber - 1,
          availableLabel: timing ? planWeekday(timing.availableOn) : "on schedule",
        } as const)
      : timing && !timing.available
        ? ({
            type: "scheduled",
            availableLabel: planWeekday(timing.availableOn),
          } as const)
        : ({ type: "ready" } as const);
  const hasWorkoutMedia = kind === "workout" || (kind === "recovery" && Boolean(optional));

  const duration =
    kind === "workout"
      ? day?.code
        ? `${sevenDayWorkoutRuntime(day.code, day.minutes ?? 15)} total`
        : "Workout duration unavailable"
      : kind === "walk"
        ? movementDuration(brief.tier)
        : null;

  const previousDay = dayNumber - 1;

  if (kind === "workout" && day?.code) {
    return (
      <WorkoutScreen
        kicker={`Day ${dayNumber} of 7`}
        title={title}
        description={`${duration ?? "Workout duration unavailable"}. Use the easier option any time you need it.`}
        media={
          <WorkoutMediaCard
            dayNumber={dayNumber}
            dayLabel={`Day ${dayNumber} of 7`}
            code={day.code}
            title={title}
            state={mediaState}
          />
        }
        overview={sevenDayWorkoutOverview(day.code, day.minutes ?? 15)}
        notes={
          <>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.12em]">
                {W01_CARDIO_HEADING}
              </h3>
              <p className="mt-2 text-foreground/80">{cardioGuidance(brief.cardio)}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.12em]">Workout Approach</h3>
              <p className="mt-2 text-foreground/80">{W01_APPROACH}</p>
            </div>
          </>
        }
      >
        <section className="pb-8 pt-1">
          {completed ? (
            <div className="rounded-lg border border-border bg-gxj-mint p-4">
              <p className="text-sm font-semibold">Day {dayNumber} Complete</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Nice work. Your progress is saved.
              </p>
              <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
                <Link to="/your-plan">
                  {dayNumber === 7 && priorDone ? "See What’s Next" : "Continue to My Plan"}
                </Link>
              </Button>
            </div>
          ) : priorDone && (!timing || timing.available) ? (
            <>
              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={marking}
                onClick={markComplete}
              >
                {marking ? "Saving..." : completionLabel(day, dayNumber)}
              </Button>
              {markError ? (
                <p role="alert" className="mt-2 text-xs font-medium leading-relaxed">
                  {markError}
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      </WorkoutScreen>
    );
  }

  if (kind === "recovery" && optional) {
    return (
      <WorkoutScreen
        kicker={`Day ${dayNumber} of 7`}
        title={optional.title}
        description={`${sevenDayWorkoutRuntime(optional.code, optional.minutes)} total. Keep the movement easy.`}
        media={
          <WorkoutMediaCard
            dayNumber={dayNumber}
            dayLabel={`Day ${dayNumber} of 7`}
            code={optional.code}
            title={optional.title}
            state={mediaState}
          />
        }
        overview={sevenDayWorkoutOverview(optional.code, optional.minutes)}
        notes={
          <p className="text-foreground/80">
            This session is optional. Keep the effort easy and use it only if moving feels good
            today.
          </p>
        }
      >
        <section className="pb-8 pt-1">
          {completed ? (
            <div className="rounded-lg border border-border bg-gxj-mint p-4">
              <p className="text-sm font-semibold">Day {dayNumber} Complete</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Nice work. Your progress is saved.
              </p>
              <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
                <Link to="/your-plan">
                  {dayNumber === 7 && priorDone ? "See What’s Next" : "Continue to My Plan"}
                </Link>
              </Button>
            </div>
          ) : priorDone && (!timing || timing.available) ? (
            <>
              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={marking}
                onClick={markComplete}
              >
                {marking ? "Saving..." : completionLabel(day, dayNumber)}
              </Button>
              {markError ? (
                <p role="alert" className="mt-2 text-xs font-medium leading-relaxed">
                  {markError}
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      </WorkoutScreen>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <Link
        to="/your-plan"
        className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to My Plan
      </Link>

      <p className="gxj-kicker mt-6 text-[10px] font-semibold uppercase tracking-[0.16em]">
        Day {dayNumber} &middot; {timingHeading}
      </p>
      <h1 className="gxj-display-title mt-2 text-2xl leading-tight tracking-tight sm:text-3xl">
        {title}
      </h1>
      {duration ? <p className="mt-2 text-xs text-muted-foreground">{duration}</p> : null}

      {kind === "walk" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Take an easy walk, or choose another form of light movement you enjoy. Today is about
          helping your body recover so you’re ready for the next workout. You don’t need to push
          hard - just keep moving.
        </p>
      ) : null}
      {kind === "recovery" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Today is about helping your body recover so you’re ready for the next workout. Rest,
          hydrate, eat to your protein target, and keep any movement light. The optional recovery
          session is there if it feels good, but you don’t need to work out today.
        </p>
      ) : null}
      {kind === "rest" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your body needs time to recover from the week’s workouts. Take the day off so you finish
          the plan rested and ready for what comes next. It still counts toward completing your
          7-day plan.
        </p>
      ) : null}

      <section className="mt-8">
        {completed ? (
          <div className="rounded-lg border border-border bg-gxj-mint p-4">
            <p className="text-sm font-semibold">Day {dayNumber} Complete</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Nice work. Your progress is saved.
            </p>
            <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
              <Link to="/your-plan">
                {dayNumber === 7 && priorDone ? "See What’s Next" : "Continue to My Plan"}
              </Link>
            </Button>
          </div>
        ) : !priorDone && !hasWorkoutMedia ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Day {dayNumber} is upcoming. Complete Day {previousDay} first, then you can mark Day{" "}
              {dayNumber} complete.
            </p>
            <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
              <Link to="/your-plan/day/$day" params={{ day: String(previousDay) }}>
                Go to Day {previousDay}
              </Link>
            </Button>
          </div>
        ) : timing && !timing.available && !hasWorkoutMedia ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-semibold">Available {planWeekday(timing.availableOn)}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              You can review the details now. This day can be completed when its scheduled date
              arrives.
            </p>
          </div>
        ) : priorDone && (!timing || timing.available) ? (
          <>
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={marking}
              onClick={markComplete}
            >
              {marking ? "Saving..." : completionLabel(day, dayNumber)}
            </Button>
            {markError ? (
              <p role="alert" className="mt-2 text-xs font-medium leading-relaxed">
                {markError}
              </p>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
