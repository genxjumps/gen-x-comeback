import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/plan-access";
import { readStoredToken } from "@/lib/access-token";
import {
  assignmentType,
  cardioGuidance,
  completionLabel,
  movementDuration,
  type CardioContext,
  type PlanDayView,
} from "@/lib/lead-plan";
import { completePlanDay, getDayBrief } from "@/lib/lead.functions";
import { W01_APPROACH } from "@/lib/w01-content";
import { missingVideoNotice, workoutVideoSrc } from "@/lib/workout-videos";

type Brief = {
  cardio: CardioContext;
  completedDays: number[];
  tier: string;
  day: PlanDayView | null;
};

const SECTION = "mt-4 rounded-lg border border-border bg-card p-4";
const LABEL = "text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground";

function VideoArea({ code, title }: { code: string; title: string }) {
  const src = workoutVideoSrc(code);
  return (
    <div className="mt-6 aspect-video overflow-hidden rounded-lg border border-border bg-muted">
      {src ? (
        <iframe
          src={src}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
          title={`${code} - ${title}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4">
          <p className="text-center text-sm text-muted-foreground">{missingVideoNotice(code)}</p>
        </div>
      )}
    </div>
  );
}

function CardioSection({ cardio }: { cardio: CardioContext }) {
  return (
    <section className={SECTION}>
      <h2 className={LABEL}>Your Cardio Option</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cardioGuidance(cardio)}</p>
    </section>
  );
}

function ApproachSection() {
  return (
    <section className={SECTION}>
      <h2 className={LABEL}>How to Approach This Workout</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{W01_APPROACH}</p>
    </section>
  );
}

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

  async function markComplete() {
    if (status !== "allowed" || marking || completed || !priorDone) return;
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

  const duration =
    kind === "workout"
      ? day?.minutes
        ? `About ${day.minutes} minutes`
        : "About 15 minutes"
      : kind === "walk"
        ? movementDuration(brief.tier)
        : null;

  const previousDay = dayNumber - 1;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <Link
        to="/your-plan"
        className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to My Plan
      </Link>

      <p className="gxj-kicker mt-6 text-[10px] font-semibold uppercase tracking-[0.16em]">
        Day {dayNumber}
      </p>
      <h1 className="gxj-display-title mt-2 text-2xl leading-tight tracking-tight sm:text-3xl">
        {title}
      </h1>
      {duration ? <p className="mt-2 text-xs text-muted-foreground">{duration}</p> : null}

      {kind === "workout" && day?.description ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{day.description}</p>
      ) : null}
      {kind === "walk" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Easy movement is your assigned action for Day {dayNumber}. Walk at a conversational pace,
          or use any easy movement you enjoy. It counts toward your 7-day plan.
        </p>
      ) : null}
      {kind === "recovery" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Recovery is your assigned action for Day {dayNumber}. Keep the day easy: sleep, hydrate,
          eat to your protein target, and move gently if you feel like it. You can mark this day
          complete without doing any workout.
        </p>
      ) : null}
      {kind === "rest" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Rest is your assigned action for Day {dayNumber}. Taking the day off is the work here, and
          it counts toward completing your 7-day plan.
        </p>
      ) : null}

      {kind === "workout" && day?.code ? (
        <>
          <VideoArea code={day.code} title={title} />
          <div className="mt-2" />
          <CardioSection cardio={brief.cardio} />
          <ApproachSection />
        </>
      ) : null}

      {kind === "recovery" && optional ? (
        <>
          <section className="mt-6 rounded-lg border border-dashed border-border p-4">
            <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Optional Active Recovery
            </h2>
            <p className="mt-1 text-sm font-medium">{optional.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {optional.description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              About {optional.minutes} minutes &middot; optional, not required to complete this day
            </p>
          </section>
          <VideoArea code={optional.code} title={optional.title} />
          <CardioSection cardio={brief.cardio} />
          <ApproachSection />
        </>
      ) : null}

      <section className="mt-8">
        {completed ? (
          <div className="rounded-lg border border-border bg-gxj-mint p-4">
            <p className="text-sm font-semibold">Day {dayNumber} Complete</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Nice work. Your progress is saved.
            </p>
            <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
              <Link to="/your-plan">Continue to My Plan</Link>
            </Button>
          </div>
        ) : !priorDone ? (
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
        ) : (
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
