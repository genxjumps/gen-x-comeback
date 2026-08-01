import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { AccessDenied, readStoredToken } from "@/components/plan-access";
import {
  cardioGuidance,
  movementDuration,
  type CardioContext,
  type PlanDayView,
} from "@/lib/lead-plan";
import { completePlanDay, getDayBrief } from "@/lib/lead.functions";
import { W01_APPROACH } from "@/lib/w01-content";
import {
  W02_DURATION,
  W02_IFRAME_SRC,
  W02_MISSING_ASSET_NOTICE,
  W02_RUNDOWN,
  W02_TITLE,
} from "@/lib/w02-content";

type Brief = {
  cardio: CardioContext;
  completedDays: number[];
  tier: string;
  day: PlanDayView | null;
};

/** Protected Day 2 assignment. Requires a valid saved-plan access token. */
export function DayTwoAssignment() {
  const loadBrief = useServerFn(getDayBrief);
  const completeDay = useServerFn(completePlanDay);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredToken();
    if (!stored) {
      setStatus("denied");
      return;
    }
    void (async () => {
      try {
        const result = await loadBrief({ data: { token: stored, day: 2 as const } });
        if (cancelled) return;
        if (result.ok) {
          setBrief({
            cardio: result.cardio,
            completedDays: result.completedDays,
            tier: result.tier,
            day: result.day,
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
  }, [loadBrief]);

  const completed = brief ? brief.completedDays.includes(2) : false;
  const dayOneDone = brief ? brief.completedDays.includes(1) : false;
  const isWorkout = brief?.day?.code === "W02";

  async function markComplete() {
    if (!token || marking || completed || !dayOneDone) return;
    setMarking(true);
    setMarkError(null);
    try {
      const result = await completeDay({ data: { token, day: 2 as const } });
      if (result.ok) {
        setBrief((prev) => (prev ? { ...prev, completedDays: result.completedDays } : prev));
      } else {
        setMarkError("We could not confirm your access or your Day 1 completion. Reload and retry.");
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

  const actionLabel = isWorkout ? "Mark Day 2 Complete" : "Mark Movement Complete";

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <Link
        to="/your-plan"
        className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to My Plan
      </Link>

      <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Day 2
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {isWorkout ? W02_TITLE : (brief.day?.title ?? "Walk or easy movement")}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {isWorkout ? W02_DURATION : movementDuration(brief.tier)}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {isWorkout
          ? W02_RUNDOWN
          : "Easy movement is your assigned action for Day 2. Walk at a conversational pace, or use any easy movement you enjoy. It counts toward your 7-day plan."}
      </p>

      {isWorkout ? (
        <>
          <div className="mt-6 aspect-video overflow-hidden rounded-lg border border-border bg-muted">
            {W02_IFRAME_SRC ? (
              <iframe
                src={W02_IFRAME_SRC}
                loading="lazy"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
                title="W02 - Upper Body"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-4">
                <p className="text-center text-sm text-muted-foreground">
                  {W02_MISSING_ASSET_NOTICE}
                </p>
              </div>
            )}
          </div>

          <section className="mt-6 rounded-lg border border-border bg-card p-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Your Cardio Option
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {cardioGuidance(brief.cardio)}
            </p>
          </section>

          <section className="mt-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              How to Approach This Workout
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{W01_APPROACH}</p>
          </section>
        </>
      ) : null}

      <section className="mt-8">
        {completed ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold">Day 2 Complete</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Nice work. Your progress is saved.
            </p>
            <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
              <Link to="/your-plan">Continue to My Plan</Link>
            </Button>
          </div>
        ) : !dayOneDone ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Day 2 is upcoming. Complete Day 1 first, then you can mark Day 2 complete.
            </p>
            <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
              <Link to="/your-plan/day/$day" params={{ day: "1" }}>
                Go to Day 1
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <Button size="lg" className="w-full sm:w-auto" disabled={marking} onClick={markComplete}>
              {marking ? "Saving..." : actionLabel}
            </Button>
            {markError ? (
              <p role="alert" className="mt-2 text-xs font-medium leading-relaxed">
                {markError}
              </p>
            ) : null}
          </>
        )}
      </section>

      <div className="mt-6">
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link to="/your-plan">Back to My Plan</Link>
        </Button>
      </div>
    </div>
  );
}
