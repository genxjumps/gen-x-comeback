import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { AccessDenied, readStoredToken } from "@/components/plan-access";
import { DayOneWorkout } from "@/components/day-one-workout";
import {
  assignmentKind,
  currentAssignmentDay,
  type PlanHubData,
} from "@/lib/lead-plan";
import { getPlanHub } from "@/lib/lead.functions";

export const Route = createFileRoute("/your-plan/day/$day")({
  head: () => ({
    meta: [
      { title: "Your Assignment Details | Gen X Jumps" },
      {
        name: "description",
        content:
          "The saved details for this assignment in your 7-day plan, including the title, rundown, duration, and any optional active recovery.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your Assignment Details | Gen X Jumps" },
      {
        property: "og:description",
        content: "The saved details for this assignment in your 7-day plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DayRoutePage,
});

function DayRoutePage() {
  const { day } = Route.useParams();
  // Day 1 has its own real workout page; days 2-7 render saved assignment details.
  if (day === "1") return <DayOneWorkout />;
  return <DayDetailPage />;
}

function DayDetailPage() {
  const { day } = Route.useParams();
  const navigate = useNavigate();
  const loadHub = useServerFn(getPlanHub);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [hub, setHub] = useState<PlanHubData | null>(null);

  const dayNumber = Number(day);
  const valid = Number.isInteger(dayNumber) && dayNumber >= 2 && dayNumber <= 7;

  useEffect(() => {
    if (!valid) {
      navigate({ to: "/your-plan", replace: true });
    }
  }, [valid, navigate]);

  useEffect(() => {
    if (!valid) return;
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
  }, [valid, loadHub]);

  if (!valid) return null;

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <p className="text-sm text-muted-foreground">Loading your assignment...</p>
      </div>
    );
  }

  if (status === "denied" || !hub) return <AccessDenied />;

  const entry = hub.days.find((d) => d.day === dayNumber);
  if (!entry) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          Assignment Not Found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          That day is not part of your saved plan.
        </p>
        <Button asChild className="mt-6 w-full sm:w-auto">
          <Link to="/your-plan">Back to My Plan</Link>
        </Button>
      </div>
    );
  }

  const complete = hub.completedDays.includes(entry.day);
  const current = currentAssignmentDay(hub.days, hub.completedDays);
  const isCurrent = entry.day === current;
  const statusLabel = complete ? "Complete" : isCurrent ? "Current" : "Upcoming";

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <Link
        to="/your-plan"
        className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to My Plan
      </Link>

      <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Day {entry.day} &middot; {statusLabel}
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {entry.title}
      </h1>
      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
        {assignmentKind(entry)}
      </p>
      {entry.minutes ? (
        <p className="mt-2 text-xs text-muted-foreground">About {entry.minutes} minutes</p>
      ) : null}
      {entry.description ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{entry.description}</p>
      ) : null}

      {entry.optional ? (
        <section className="mt-6 rounded-lg border border-dashed border-border p-4">
          <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Optional Active Recovery
          </h2>
          <p className="mt-1 text-sm font-medium">{entry.optional.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {entry.optional.description}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            About {entry.optional.minutes} minutes &middot; optional, not required
          </p>
        </section>
      ) : null}

      {!complete && !isCurrent ? (
        <section className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Complete the current assignment before marking this day complete.
          </p>
        </section>
      ) : null}

      {isCurrent ? (
        <section className="mt-6 rounded-lg border border-border bg-card p-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Workout delivery and completion for this assignment will be connected in a later
            checkpoint.
          </p>
        </section>
      ) : null}

      <div className="mt-8">
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link to="/your-plan">Back to My Plan</Link>
        </Button>
      </div>
    </div>
  );
}
