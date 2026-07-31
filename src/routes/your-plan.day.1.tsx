import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { readAnswers, type Answers } from "@/lib/plan";
import { ACCESS_TOKEN_STORAGE_KEY, RAW_TOKEN_RE } from "@/lib/lead-plan";
import { completePlanDay, getPlanProgress, verifyAccessToken } from "@/lib/lead.functions";


export const Route = createFileRoute("/your-plan/day/1")({
  head: () => ({
    meta: [
      { title: "Day 1 - Full Body Flush & Fire | Gen X Jumps" },
      {
        name: "description",
        content:
          "Your assigned Day 1 workout: about 15 minutes of short jump rope intervals mixed with squats, push-ups, and balance work, with a cardio option matched to your assessment.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Day 1 - Full Body Flush & Fire | Gen X Jumps" },
      {
        property: "og:description",
        content:
          "Your assigned Day 1 workout: about 15 minutes of short jump rope intervals mixed with squats, push-ups, and balance work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DayOnePage,
});

const IFRAME_SRC =
  "https://customer-cvsfidz4ao4uk9i5.cloudflarestream.com/40ae220635bc55bc66d1f68cb11ab997/iframe?poster=https%3A%2F%2Fcustomer-cvsfidz4ao4uk9i5.cloudflarestream.com%2F40ae220635bc55bc66d1f68cb11ab997%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600";

const EXPECT = [
  "Three circuits",
  "Three rounds per circuit",
  "20-second cardio intervals",
  "Bodyweight repetitions",
  "Built-in rest and circuit breaks",
];

const EQUIPMENT_NOTES = [
  "No dumbbells required",
  "Jump rope optional because ghost jumps or lower-impact cardio can replace it",
  "Mat or cushioned surface recommended for floor work",
];

export function cardioOption(a: Answers): string {
  const impactLimited = a.q4.includes("limit_impact");
  const ownsRope = Array.isArray(a.equipment) && a.equipment.includes("jump_rope");
  if (impactLimited) {
    return "During every jump rope interval, march in place or use step-touches instead of jumping. Keep one foot on the floor the entire time and drive the pace with your arms and your breathing.";
  }
  if (!ownsRope || a.q3 === "no_rope") {
    return "Use ghost jumps for every cardio interval. Ghost jumps are small two-foot hops while you turn your hands as though you were holding a rope.";
  }
  if (a.q3 === "new") {
    return "Try the rope at the start of each interval. When resetting the rope takes over more than the jumping does, put it down and finish the interval with ghost jumps. Ghost jumps are small two-foot hops while you turn your hands as though you were holding a rope.";
  }
  if (a.q3 === "short_bursts") {
    return "Use the rope while your rhythm is clean, then finish the interval with ghost jumps as needed. Ghost jumps are small two-foot hops while you turn your hands as though you were holding a rope.";
  }
  return "Use the rope normally for every cardio interval and scale your pace as needed. Slow the turns down before you break your rhythm.";
}

function readStoredToken(): string | null {
  try {
    const v = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return v && RAW_TOKEN_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

function DayOnePage() {
  const verify = useServerFn(verifyAccessToken);
  const loadProgress = useServerFn(getPlanProgress);
  const completeDay = useServerFn(completePlanDay);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const a = readAnswers();
    const stored = readStoredToken();
    if (!stored) {
      setStatus("denied");
      return;
    }
    void (async () => {
      try {
        const result = await verify({ data: { token: stored } });
        if (cancelled) return;
        if (result.ok) {
          setAnswers(a);
          setToken(stored);
          setStatus("allowed");
          const progress = await loadProgress({ data: { token: stored } });
          if (!cancelled && progress.ok) setCompleted(progress.completedDays.includes(1));
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
  }, [verify, loadProgress]);

  async function markComplete() {
    if (!token || marking || completed) return;
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

  if (status === "denied" || !answers) {
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
            <Link to="/assessment/complete">Go to My Plan</Link>
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
        to="/assessment/complete"
        className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to My Plan
      </Link>

      <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Day 1
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        Full Body Flush &amp; Fire
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">About 15 minutes</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Short jump rope intervals mixed with squats, push-ups, and balance work.
      </p>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          What to Expect
        </h2>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {EXPECT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="mt-6 aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        <iframe
          src={IFRAME_SRC}
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
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cardioOption(answers)}</p>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          How to Approach This Workout
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          These workouts are supposed to challenge you. Work hard. Rest when needed. Do fewer reps
          or use a smaller range of motion when necessary. Skip a movement you cannot perform
          safely. Stop if you feel pain rather than normal exercise discomfort.
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Equipment
        </h2>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {EQUIPMENT_NOTES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link to="/assessment/complete">Back to My Plan</Link>
        </Button>
      </div>
    </div>
  );
}
