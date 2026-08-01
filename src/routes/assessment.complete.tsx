import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { buildPlan, readAnswers, type Answers } from "@/lib/plan";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  CONSENT_COPY,
  LEGACY_ACCESS_MARKER_KEY,
  RAW_TOKEN_RE,
  TOTAL_ASSIGNMENTS,
} from "@/lib/lead-plan";
import {
  getPlanProgress,
  regeneratePlanWithToken,
  saveLeadPlan,
} from "@/lib/lead.functions";

export const Route = createFileRoute("/assessment/complete")({
  head: () => ({
    meta: [
      { title: "Your 7-Day Fitness Plan Is Ready | Gen X Jumps" },
      {
        name: "description",
        content:
          "Save your personalized 7-day workout schedule and daily protein target, built around your exercise level, jump rope experience, equipment, impact needs, and available training days.",
      },
      { property: "og:title", content: "Your 7-Day Fitness Plan Is Ready | Gen X Jumps" },
      {
        property: "og:description",
        content:
          "A personalized 7-day workout schedule and daily protein target based on your exercise level, jump rope experience, equipment, impact needs, and training days.",
      },
    ],
  }),
  component: ResultsPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isCompleteDraft(a: Answers): boolean {
  const q1 = ["none", "one", "two_three", "four_plus"].includes(a.q1);
  const q2 = ["long_break", "inconsistent", "active_needs_plan"].includes(a.q2);
  const q3 = ["never", "no_rope", "new", "short_bursts", "comfortable"].includes(a.q3);
  const q4 = a.q4.length === 1 && ["none", "limit_impact"].includes(a.q4[0]);
  const q5 = ["3", "4", "5", "6_7"].includes(a.q5);
  const equipment = a.equipment.length > 0;
  return q1 && q2 && q3 && q4 && q5 && equipment;
}

function readStoredToken(): string | null {
  try {
    const v = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return v && RAW_TOKEN_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** Reads a one-time `?access=` recovery token and strips it from the visible URL. */
function takeRecoveryTokenFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("access");
    if (!raw) return null;
    url.searchParams.delete("access");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    return RAW_TOKEN_RE.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

function ResultsPage() {
  const navigate = useNavigate();
  const save = useServerFn(saveLeadPlan);
  const regenerate = useServerFn(regeneratePlanWithToken);
  const loadProgress = useServerFn(getPlanProgress);

  const [answers, setAnswers] = useState<Answers | null>(null);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [recognized, setRecognized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [completedDays, setCompletedDays] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    const a = readAnswers();
    if (!isCompleteDraft(a)) {
      navigate({ to: "/assessment" });
      return;
    }
    setAnswers(a);

    // The old boolean marker never unlocks anything on its own.
    try {
      window.localStorage.removeItem(LEGACY_ACCESS_MARKER_KEY);
    } catch {
      /* ignore storage errors */
    }

    const recoveryToken = takeRecoveryTokenFromUrl();
    const token = recoveryToken ?? readStoredToken();
    if (!token) {
      setCheckingAccess(false);
      return;
    }

    void (async () => {
      try {
        const result = await regenerate({ data: { token, assessment: a } });
        if (cancelled) return;
        if (result.ok) {
          try {
            window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
          } catch {
            /* ignore storage errors */
          }
          setRecognized(true);
          setUnlocked(true);
          const progress = await loadProgress({ data: { token } });
          if (!cancelled && progress.ok) setCompletedDays(progress.completedDays);
          // Latest answers are processed and saved: the private hub is the destination.
          if (!cancelled) navigate({ to: "/your-plan", replace: true });
        } else if (!recoveryToken) {
          try {
            window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
          } catch {
            /* ignore storage errors */
          }
        }
      } catch {
        /* fall back to the first-time opt-in form */
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, regenerate, loadProgress]);


  const plan = useMemo(() => (answers ? buildPlan(answers) : null), [answers]);

  if (!answers || !plan) return null;

  const dayOne = plan.days[0];
  const rest = plan.days.slice(1);
  const nameOk = firstName.trim().length > 0;
  const emailOk = EMAIL_RE.test(email.trim());
  const dayOneComplete = completedDays.includes(1);
  const currentDay = unlocked && dayOneComplete ? 2 : 1;


  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        Your Personalized 7-Day Fitness Plan Is Ready
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Based on your answers, I&rsquo;ve built this plan around your current exercise level, jump
        rope experience, available equipment, whether you need a lower-impact option, and the number
        of days you can consistently train.
      </p>
      {recognized ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This browser recognizes your previous access. Your latest answers were used to rebuild this
          plan.
        </p>
      ) : null}

      {/* Protein */}
      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Your Daily Protein Target
        </h2>
        {plan.protein.grams !== null ? (
          <>
            <p className="mt-1.5 text-lg font-semibold tracking-tight">
              Aim for {plan.protein.grams} grams per day
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
            <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
              <li>150 lb - about 150 g/day</li>
              <li>180 lb - about 180 g/day</li>
              <li>200 lb - about 200 g/day</li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A simple way to get there is to build three or four meals or eating times around a
              solid protein source. Aim for roughly 30-40 grams each time, then adjust based on your
              bodyweight target.
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed">
              Protein first. Before you build the rest of the meal, decide where the protein is
              coming from.
            </p>
          </>
        )}
      </section>

      {/* How to approach the workouts */}
      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          How to Approach the Workouts
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          These workouts are supposed to challenge you. Work hard. Rest when needed. Do fewer reps
          or use a smaller range of motion when necessary. Skip a movement you cannot perform
          safely. Stop if you feel pain rather than normal exercise discomfort.
        </p>
      </section>

      {/* Days */}
      <section className="mt-8">
        {unlocked ? (
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            {completedDays.length} of {TOTAL_ASSIGNMENTS} assignments complete
          </p>
        ) : null}
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          <li className="bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">Day 1: {dayOne.title}</h3>
              <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                {dayOneComplete ? "Complete" : "Today"}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {dayOne.description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">About 15 minutes</p>
            <Button
              asChild
              size="sm"
              variant={dayOneComplete ? "outline" : "default"}
              className="mt-3 w-full sm:w-auto"
            >
              <Link to="/your-plan/day/1">
                {dayOneComplete ? "Review Day 1 Workout" : "Start Day 1 Workout"}
              </Link>
            </Button>

          </li>

          {rest.map((d) => (
            <li key={d.day} className={unlocked ? "bg-card p-4" : "bg-muted/30 p-4"}>
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  className={
                    unlocked ? "text-sm font-medium" : "text-sm font-medium text-muted-foreground/80"
                  }
                >
                  Day {d.day}: {d.title}
                </h3>
                {unlocked && d.day === currentDay ? (
                  <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Up Next
                  </span>
                ) : null}
              </div>

              {d.description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {d.description}
                </p>
              ) : null}
              {d.minutes ? (
                <p className="mt-2 text-xs text-muted-foreground">About 15 minutes</p>
              ) : null}
              {d.optional ? (
                <div className="mt-3 rounded-md border border-dashed border-border p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Optional Active Recovery
                  </p>
                  <p className="mt-1 text-sm font-medium">{d.optional.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {d.optional.description}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    About 15 minutes &middot; optional, not required
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <Separator className="my-8" />

      {unlocked ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Your Full 7-Day Workout Plan Is Unlocked
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your complete workout and recovery schedule is now available. Start with Day 1 and
            follow the plan in order.
          </p>
        </section>
      ) : checkingAccess ? null : (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Unlock Your Full 7-Day Workout Plan
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Enter your first name and email to unlock Days 2 through 7.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              You&rsquo;ll Unlock
            </h3>
            <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
              <li>The remaining guided video workouts</li>
              <li>Your complete workout and recovery schedule</li>
              <li>Clear guidance for scaling pace, reps, rest, range of motion, and impact</li>
            </ul>
          </div>



          <form
            className="mt-4 grid gap-3 rounded-lg border border-border bg-card p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setShowErrors(true);
              if (!nameOk || !emailOk || !consent || saving) return;
              setSaving(true);
              setError(null);
              try {
                const result = await save({
                  data: {
                    firstName: firstName.trim(),
                    email: email.trim(),
                    consentGranted: true as const,
                    assessment: answers,
                  },
                });
                try {
                  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, result.accessToken);
                } catch {
                  /* ignore storage errors */
                }
                setUnlocked(true);
                navigate({ to: "/your-plan" });
              } catch {
                setError("We couldn\u2019t save your plan. Your answers are still here. Try again.");
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="first-name">First name</Label>
              <Input
                id="first-name"
                name="firstName"
                autoComplete="given-name"
                value={firstName}
                maxLength={60}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              {showErrors && !nameOk ? (
                <p className="text-xs text-muted-foreground">Enter your first name.</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {showErrors && !emailOk ? (
                <p className="text-xs text-muted-foreground">Enter a valid email address.</p>
              ) : null}
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="consent" className="text-xs font-normal leading-relaxed">
                {CONSENT_COPY}
              </Label>
            </div>
            {showErrors && !consent ? (
              <p className="text-xs text-muted-foreground">You need to agree before continuing.</p>
            ) : null}
            <Button type="submit" className="mt-1 w-full" disabled={saving}>
              {saving ? "Saving your plan..." : "Unlock My Full 7-Day Workout Plan"}
            </Button>
            {error ? (
              <p role="alert" className="text-xs font-medium leading-relaxed">
                {error}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Free. Get immediate access after submitting.
            </p>
          </form>
        </section>
      )}
    </div>
  );
}
