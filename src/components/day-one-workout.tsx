import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { readStoredToken } from "@/components/plan-access";
import { cardioGuidance, type CardioContext } from "@/lib/lead-plan";
import { completePlanDay, getDayOneBrief } from "@/lib/lead.functions";
import {
  W01_APPROACH,
  W01_DURATION,
  W01_EQUIPMENT_NOTES,
  W01_EXPECT,
  W01_IFRAME_SRC,
  W01_RUNDOWN,
  W01_TITLE,
} from "@/lib/w01-content";

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
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
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
            <Link to="/assessment/start">Build My 7-Day Plan</Link>
          </Button>
        </div>
      </div>
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

      <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Day 1
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {W01_TITLE}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">{W01_DURATION}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {W01_RUNDOWN}
      </p>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          What to Expect
        </h2>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {W01_EXPECT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="mt-6 aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        <iframe
          src={W01_IFRAME_SRC}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
          title="W01 - Full Body Flush & Fire"
        />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Your Cardio Option
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cardioGuidance(cardio)}</p>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          How to Approach This Workout
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {W01_APPROACH}
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Equipment
        </h2>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {W01_EQUIPMENT_NOTES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        {completed ? (
          <div className="rounded-lg border border-border bg-card p-4">
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

      <div className="mt-6">
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link to="/your-plan">Back to My Plan</Link>
        </Button>
      </div>
    </div>
  );
}
