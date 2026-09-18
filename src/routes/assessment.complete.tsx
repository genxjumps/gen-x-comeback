import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppLoadingState, AppNotice, AppStatePanel } from "@/components/precision-surfaces";
import { Button } from "@/components/ui/button";
import { IntakeClosed } from "@/components/intake-closed";
import { Separator } from "@/components/ui/separator";
import { buildPlan, isCompleteDraft, readAnswers, type Answers } from "@/lib/plan";
import { bindSignupDraft } from "@/lib/signup-draft";
import { ACCESS_TOKEN_STORAGE_KEY, RAW_TOKEN_RE } from "@/lib/lead-plan";
import {
  regeneratePlanWithToken,
  verifyAccessToken,
  saveLeadPlan,
  saveLeadPlanFromHandoff,
} from "@/lib/lead.functions";
import { getSubmissionAttempt } from "@/lib/plan-submission";
import { readStoredToken, clearStoredToken } from "@/lib/access-token";
import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";
import { clearLeadIntakeDraft, readLeadIntakeDraft } from "@/lib/lead-intake-draft";
import type { LeadIntakeDraft } from "@/lib/lead-intake-draft";
import { getLeadIntakeWelcome } from "@/lib/lead-intake.functions";
import { isVisualReviewMode } from "@/lib/visual-review";

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

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function ResultsPage() {
  const navigate = useNavigate();
  const save = useServerFn(saveLeadPlan);
  const saveFromHandoff = useServerFn(saveLeadPlanFromHandoff);
  const regenerate = useServerFn(regeneratePlanWithToken);
  const verify = useServerFn(verifyAccessToken);
  const loadHandoff = useServerFn(getLeadIntakeWelcome);

  const [answers, setAnswers] = useState<Answers | null>(null);
  const [intakeDraft, setIntakeDraft] = useState<LeadIntakeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [recognized, setRecognized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [visualReview, setVisualReview] = useState(false);
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
    if (isVisualReviewMode()) {
      setVisualReview(true);
      setCheckingAccess(false);
      setHandoffStatus("missing");
      setUnlocked(true);
      return;
    }
    const draft = readLeadIntakeDraft();
    if (draft) {
      setIntakeDraft(draft);
    }

    const recoveryToken = takeRecoveryTokenFromUrl();
    const token = recoveryToken ?? readStoredToken();

    void (async () => {
      try {
        const handoff = await loadHandoff({ data: { token } }).catch(() => null);
        if (cancelled) return;
        if (handoff?.ok && handoff.state !== "setup") {
          if (handoff.useCookie) clearStoredToken();
          navigate({
            to: handoff.state === "plan" ? "/your-plan" : "/welcome",
            hash: handoff.platformAuthTokenHash
              ? `gxj_auth=${encodeURIComponent(handoff.platformAuthTokenHash)}`
              : undefined,
            replace: true,
          });
          return;
        }
        const hasHandoff = handoff?.ok === true && handoff.state === "setup";
        setHandoffStatus(hasHandoff ? "available" : "missing");

        // A fresh website signup is authoritative. Do not accidentally rebuild
        // an older plan that happens to be recognized in this browser.
        if (hasHandoff) {
          bindSignupDraft(handoff.draftKey);
          const scoped = readAnswers();
          if (!isCompleteDraft(scoped)) {
            setAnswers(null);
            navigate({ to: "/welcome", replace: true });
            return;
          }
          setAnswers(scoped);
          return;
        }

        // Recognition never rebuilds a plan during a page load.
        const result = await verify({ data: { token } });
        if (cancelled) return;
        if (result.ok) {
          setRecognized(true);
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
  }, [loadHandoff, navigate, verify]);

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
    if (handoffStatus !== "available") {
      clearLeadIntakeDraft();
      navigate({ to: "/welcome", replace: true });
      return;
    }
    frontEnrollmentAttempted.current = true;
    setError(null);
    void (async () => {
      try {
        const access = await getSubmissionAttempt(answers);
        if (handoffStatus === "available") {
          const saved = await saveFromHandoff({
            data: {
              submissionId: access.submissionId,
              sessionTokenHash: access.hash,
              assessment: answers,
              timeZone: browserTimeZone(),
            },
          });
          if (saved.outcome !== "saved") {
            navigate({ to: "/welcome", replace: true });
            return;
          }
        } else if (intakeDraft) {
          await save({
            data: {
              submissionId: access.submissionId,
              sessionTokenHash: access.hash,
              firstName: intakeDraft.firstName,
              email: intakeDraft.email,
              consentGranted: true,
              assessment: answers,
              timeZone: browserTimeZone(),
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
      <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
        Your Personalized 7-Day Fitness Plan Is Ready
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Based on your answers, I&rsquo;ve built this plan around your current exercise level, jump
        rope experience, available equipment, whether you need a lower-impact option, and the number
        of days you can consistently train.
      </p>
      {recognized ? (
        <AppNotice tone="warning" className="mt-4">
          Your saved plan is still intact. Confirm below if you want to replace it with these
          answers.
        </AppNotice>
      ) : null}

      {/* Protein */}
      <section className="mt-6 border-y border-[var(--pu-border-strong)] py-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]">
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
      <section className="mt-5 border-b border-[var(--pu-border-subtle)] pb-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]">
          How to Approach the Workouts
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Work hard, but go at your own pace. Rest when needed. Do fewer reps or use a smaller range
          of motion if necessary. Skip anything you can’t do safely, but try to push yourself so you
          continue to improve. Stop if you feel pain.
        </p>
      </section>

      {/* Days */}
      <section className="mt-8">
        <ul className="mt-3 divide-y divide-[var(--pu-border-subtle)] border-y border-[var(--pu-border-strong)]">
          <li className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">Day 1: {dayOne.title}</h3>
              <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                Today
              </span>
            </div>
            <Button asChild size="sm" variant="default" className="mt-2 w-full sm:w-auto">
              <Link
                {...(unlocked && !visualReview
                  ? { to: "/your-plan/day/$day" as const, params: { day: "1" } }
                  : { to: "/preview/w01" as const })}
              >
                Start Day 1 Workout
              </Link>
            </Button>
          </li>

          {rest.map((d) => (
            <li key={d.day} className={unlocked ? "py-3" : "bg-[var(--pu-surface-subtle)] py-3"}>
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  className={
                    unlocked
                      ? "text-sm font-medium"
                      : "text-sm font-medium text-[var(--pu-text-secondary)]"
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

      {recognized && !unlocked ? (
        <section className="border-y border-[var(--pu-border-strong)] py-5">
          <h2 className="text-lg font-semibold">Replace My Current Plan?</h2>
          <p className="mt-2 text-sm">
            This saves these answers and resets your current progress. Completed plans must be
            restarted from My Plan.
          </p>
          <Button
            className="mt-4"
            onClick={async () => {
              if (!answers) return;
              try {
                const next = await getSubmissionAttempt(answers);
                const result = await regenerate({
                  data: {
                    submissionId: next.submissionId,
                    sessionTokenHash: next.hash,
                    token: readStoredToken(),
                    assessment: answers,
                  },
                });
                if (!result.ok) {
                  navigate({ to: "/your-plan", replace: true });
                  return;
                }
                window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, next.raw);
                navigate({ to: "/your-plan", replace: true });
              } catch {
                setError("We couldn't update your plan. Try again or return to My Plan.");
              }
            }}
          >
            Confirm - Replace My Plan
          </Button>
          <Button asChild variant="outline" className="mt-4 ml-3">
            <Link to="/your-plan">Keep My Plan</Link>
          </Button>
          {error ? (
            <AppNotice tone="danger" className="mt-4" role="alert">
              {error}
            </AppNotice>
          ) : null}
        </section>
      ) : unlocked ? (
        <>
          <AppNotice tone="success">
            <strong className="block text-[var(--pu-text-primary)]">
              Your Full 7-Day Workout Plan Is Unlocked
            </strong>
            <span className="mt-1 block">
              Your complete workout and recovery schedule is now available. Start with Day 1 and
              follow the plan in order.
            </span>
          </AppNotice>
          {visualReview ? (
            <Button asChild className="mt-4 w-full sm:w-auto">
              <Link to="/plan-ready">Continue to Home Screen Setup</Link>
            </Button>
          ) : null}
        </>
      ) : checkingAccess ||
        handoffStatus === "checking" ||
        handoffStatus === "available" ||
        intakeDraft ? (
        <div aria-live="polite">
          {error ? (
            <>
              <AppNotice tone="danger">
                Your answers are still here. Try saving your plan again.
              </AppNotice>
              <Button
                type="button"
                className="mt-4 w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                Try Saving My Plan Again
              </Button>
            </>
          ) : (
            <div>
              <p className="mb-3 text-sm font-semibold">Opening Your 7-Day Plan</p>
              <AppLoadingState label="Saving your 7-Day plan" lines={2} />
            </div>
          )}
        </div>
      ) : !NEW_PLAN_INTAKE_OPEN ? (
        <IntakeClosed />
      ) : (
        <AppStatePanel
          state="error"
          title="Your Answers Are Still Saved"
          description="We couldn't find the secure signup that brought you here. Return to the short website form and submit it again. You won't need to repeat these assessment answers."
          action={
            <Button asChild>
              <a href="https://genxjumps.com/start-here/#seven-day-optin">Return to My Signup</a>
            </Button>
          }
        />
      )}
    </div>
  );
}
