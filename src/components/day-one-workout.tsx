import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { WorkoutMediaCard } from "@/components/workout-media-card";
import { WorkoutScreen } from "@/components/workout-screen";
import { readStoredToken } from "@/lib/access-token";
import { cardioGuidance, type CardioContext } from "@/lib/lead-plan";
import { completePlanDay, getDayOneBrief } from "@/lib/lead.functions";
import { WORKOUTS } from "@/lib/plan";
import { W01_APPROACH, W01_CARDIO_HEADING, W01_TITLE } from "@/lib/w01-content";
import { sevenDayWorkoutOverview } from "@/lib/workout-presentation";

/** Protected Day 1 workout. Requires a valid saved-plan access token. */
export function DayOneWorkout() {
  const loadBrief = useServerFn(getDayOneBrief);
  const completeDay = useServerFn(completePlanDay);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [cardio, setCardio] = useState<CardioContext | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A missing local token is still valid: an authorized return-link session
    // cookie from the emailed link can carry access on another browser.
    const stored = readStoredToken();
    void (async () => {
      try {
        const result = await loadBrief({ data: { token: stored } });
        if (cancelled) return;
        if (result.ok) {
          setCardio(result.cardio);
          setCompleted(result.completedDays.includes(1));
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
  }, [loadBrief]);

  async function markComplete() {
    if (status !== "allowed" || marking || completed) return;
    setMarking(true);
    setMarkError(null);
    try {
      const result = await completeDay({ data: { token, day: 1 as const } });
      if (result.ok) setCompleted(true);
      else setMarkError("We could not confirm your access. Open your plan again and retry.");
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

  if (status === "denied" || !cardio) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <h1 className="gxj-display-title text-2xl leading-tight tracking-tight sm:text-3xl">
          This Workout Is Part of Your 7-Day Plan
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We could not confirm access from this browser. Build your plan or open your saved results
          to unlock Day 1.
        </p>
        <div className="mt-6 grid gap-3 sm:flex">
          <Button asChild className="w-full sm:w-auto">
            <Link to="/your-plan">Go to My Plan</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/assessment/start">Create My 7-Day Plan</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <WorkoutScreen
      kicker="Day 1 of 7"
      title={W01_TITLE}
      description="About 15 minutes. Use the easier option any time you need it."
      media={
        <WorkoutMediaCard
          dayNumber={1}
          dayLabel="Day 1 of 7"
          code="W01"
          title={W01_TITLE}
          coverTitle={WORKOUTS.W01.title}
          state={completed ? { type: "completed" } : { type: "ready" }}
        />
      }
      overview={sevenDayWorkoutOverview("W01", 15)}
      notes={
        <>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.12em]">{W01_CARDIO_HEADING}</h3>
            <p className="mt-2 text-foreground/80">{cardioGuidance(cardio)}</p>
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
            <p className="text-sm font-semibold">Day 1 Complete</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Nice work. Your progress is saved.
            </p>
            <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
              <Link to="/your-plan">Continue to My Plan</Link>
            </Button>
          </div>
        ) : (
          <>
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={marking}
              onClick={markComplete}
            >
              {marking ? "Saving..." : "Mark Day 1 Complete"}
            </Button>
            {markError ? (
              <p role="alert" className="mt-2 text-xs font-medium leading-relaxed">
                {markError}
              </p>
            ) : null}
          </>
        )}
      </section>
    </WorkoutScreen>
  );
}
