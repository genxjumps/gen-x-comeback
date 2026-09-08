import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { IntakeClosed } from "@/components/intake-closed";
import { Separator } from "@/components/ui/separator";
import { buildPlan, isCompleteDraft, readAnswers, type Answers } from "@/lib/plan";
import { ACCESS_TOKEN_STORAGE_KEY, RAW_TOKEN_RE } from "@/lib/lead-plan";
import {
  regeneratePlanWithToken,
  saveLeadPlan,
  saveLeadPlanFromHandoff,
} from "@/lib/lead.functions";
import { getSubmissionAttempt } from "@/lib/plan-submission";
import { readStoredToken } from "@/lib/access-token";
import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";
import { clearLeadIntakeDraft, readLeadIntakeDraft } from "@/lib/lead-intake-draft";
import type { LeadIntakeDraft } from "@/lib/lead-intake-draft";
import { getLeadIntakeWelcome } from "@/lib/lead-intake.functions";

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
  const saveFromHandoff = useServerFn(saveLeadPlanFromHandoff);
  const regenerate = useServerFn(regeneratePlanWithToken);
  const loadHandoff = useServerFn(getLeadIntakeWelcome);

  const [answers, setAnswers] = useState<Answers | null>(null);
  const [intakeDraft, setIntakeDraft] = useState<LeadIntakeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [recognized, setRecognized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [handoffStatus, setHandoffStatus] = useState<"checking" | "available" | "missing">(
    "checking",
  );
  const frontEnrollmentAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const a = readAnswers();
    if (!isCompleteDraft(a)) {
      navigate({ to: "/assessment" });
      return;
    }
    setAnswers(a);
    const draft = readLeadIntakeDraft();
    if (draft) {
      setIntakeDraft(draft);
    }

    const recoveryToken = takeRecoveryTokenFromUrl();
    const token = recoveryToken ?? readStoredToken();

    void (async () => {
      try {
        const handoff = await loadHandoff({ data: {} }).catch(() => null);
        if (cancelled) return;
        const hasHandoff = handoff?.ok === true;
        setHandoffStatus(hasHandoff ? "available" : "missing");

        // A fresh website signup is authoritative. Do not accidentally rebuild
        // an older plan that happens to be recognized in this browser.
        if (hasHandoff) return;

        // Exact retries retain the same binding; changed answers mint a fresh one.
        const next = await getSubmissionAttempt(a);
        const result = await regenerate({
          data: {
            submissionId: next.submissionId,
            sessionTokenHash: next.hash,
            token,
            assessment: a,
          },
        });
        if (cancelled) return;
        if (result.ok) {
          try {
            window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, next.raw);
          } catch {
            /* ignore storage errors */
          }
          setRecognized(true);
          setUnlocked(true);
          // Latest answers are processed and saved: the private hub is the destination.
          if (!cancelled) navigate({ to: "/your-plan", replace: true });
        } else if (!recoveryToken && token) {
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
  }, [loadHandoff, navigate, regenerate]);

  useEffect(() => {
    if (
      !answers ||
      checkingAccess ||
      handoffStatus === "checking" ||
      unlocked ||
      frontEnrollmentAttempted.current
    ) {
      return;
    }
    if (!intakeDraft && handoffStatus !== "available") return;
    frontEnrollmentAttempted.current = true;
    setError(null);
    void (async () => {
      try {
        const access = await getSubmissionAttempt(answers);
        if (handoffStatus === "available") {
          await saveFromHandoff({
            data: {
              submissionId: access.submissionId,
              sessionTokenHash: access.hash,
              assessment: answers,
            },
          });
        } else if (intakeDraft) {
          await save({
            data: {
              submissionId: access.submissionId,
              sessionTokenHash: access.hash,
              firstName: intakeDraft.firstName,
              email: intakeDraft.email,
              consentGranted: true,
              assessment: answers,
            },
          });
        }
        try {
          window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, access.raw);
        } catch {
          /* ignore storage errors */
        }
        clearLeadIntakeDraft();
        setUnlocked(true);
        navigate({ to: "/plan-ready", replace: true });
      } catch {
        if (handoffStatus !== "available") setIntakeDraft(null);
        setError("We couldn\u2019t save your plan. Your answers are still here. Try again.");
      }
    })();
  }, [
    answers,
    checkingAccess,
    handoffStatus,
    intakeDraft,
    navigate,
    save,
    saveFromHandoff,
    unlocked,
  ]);

  const plan = useMemo(() => (answers ? buildPlan(answers) : null), [answers]);

  if (!answers || !plan) return null;

  const dayOne = plan.days[0];
  const rest = plan.days.slice(1);
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="gxj-display-title text-2xl leading-tight tracking-tight sm:text-3xl">
        Your Personalized 7-Day Fitness Plan Is Ready
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Based on your answers, I&rsquo;ve built this plan around your current exercise level, jump
        rope experience, available equipment, whether you need a lower-impact option, and the number
        of days you can consistently train.
      </p>
      {recognized ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This browser recognizes your previous access. Your latest answers were used to rebuild
          this plan.
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
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          <li className="bg-card px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">Day 1: {dayOne.title}</h3>
              <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                Today
              </span>
            </div>
            <Button asChild size="sm" variant="default" className="mt-2 w-full sm:w-auto">
              <Link
                {...(unlocked
                  ? { to: "/your-plan/day/$day" as const, params: { day: "1" } }
                  : { to: "/preview/w01" as const })}
              >
                Start Day 1 Workout
              </Link>
            </Button>
          </li>

          {rest.map((d) => (
            <li key={d.day} className={unlocked ? "bg-card px-4 py-2" : "bg-muted/30 px-4 py-2"}>
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  className={
                    unlocked
                      ? "text-sm font-medium"
                      : "text-sm font-medium text-muted-foreground/80"
                  }
                >
                  Day {d.day}: {d.title}
                </h3>
              </div>
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
      ) : checkingAccess ||
        handoffStatus === "checking" ||
        handoffStatus === "available" ||
        intakeDraft ? (
        <section className="rounded-lg border border-border bg-card p-4" aria-live="polite">
          <h2 className="text-lg font-semibold tracking-tight">Opening Your 7-Day Plan</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {error
              ? "Your answers are still here. Try saving your plan again."
              : "Your answers are complete. We’re saving your plan now."}
          </p>
          {error ? (
            <Button
              type="button"
              className="mt-4 w-full sm:w-auto"
              onClick={() => window.location.reload()}
            >
              Try Saving My Plan Again
            </Button>
          ) : null}
        </section>
      ) : !NEW_PLAN_INTAKE_OPEN ? (
        <IntakeClosed />
      ) : (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold tracking-tight">Your Answers Are Still Saved</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We couldn&rsquo;t find the secure signup that brought you here. Return to the short
            website form and submit it again. You won&rsquo;t need to repeat these assessment
            answers.
          </p>
          <Button asChild className="mt-4 w-full sm:w-auto">
            <a href="https://genxjumps.com/start-here/#seven-day-optin">Return to My Signup</a>
          </Button>
        </section>
      )}
    </div>
  );
}
