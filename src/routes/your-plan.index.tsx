import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SevenDayNextStep } from "@/components/seven-day-next-step";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/plan-access";
import { InstallNudge, type InstallEventName } from "@/components/pwa-install";
import { getSubmissionAttempt } from "@/lib/plan-submission";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/lead-plan";
import { readStoredToken } from "@/lib/access-token";
import {
  TOTAL_ASSIGNMENTS,
  assignmentKind,
  currentAssignmentDay,
  planDayHeading,
  planDayTiming,
  type PlanHubData,
} from "@/lib/lead-plan";
import {
  getPlanHub,
  recordOnboardingEvent,
  startDayOne,
  restartCompletedPlan,
  beginPlanUpdate,
} from "@/lib/lead.functions";
import type { InstallPlatform } from "@/lib/pwa-install";

export const Route = createFileRoute("/your-plan/")({
  head: () => ({
    meta: [
      { title: "My Plan - Your 7-Day Workouts | Gen X Jumps" },
      {
        name: "description",
        content:
          "Your saved 7-day plan hub: today’s workout, your full schedule, your daily protein target, and how to approach the workouts.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "My Plan - Your 7-Day Workouts | Gen X Jumps" },
      {
        property: "og:description",
        content:
          "Your saved 7-day plan hub: today’s workout, your full schedule, and your daily protein target.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanHubPage,
});

const ROW_CLASS = "block px-4 py-2.5 hover:bg-muted/60";

function RowLink({ day, children }: { day: number; children: ReactNode }) {
  if (day === 1) {
    return (
      <Link to="/your-plan/day/$day" params={{ day: "1" }} className={ROW_CLASS}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/your-plan/day/$day" params={{ day: String(day) }} className={ROW_CLASS}>
      {children}
    </Link>
  );
}

function PlanHubPage() {
  const navigate = useNavigate();
  const loadHub = useServerFn(getPlanHub);
  const recordDayOneStart = useServerFn(startDayOne);
  const saveOnboardingEvent = useServerFn(recordOnboardingEvent);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [hub, setHub] = useState<PlanHubData | null>(null);
  const beginUpdate = useServerFn(beginPlanUpdate);
  const restart = useServerFn(restartCompletedPlan);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [startingDayOne, setStartingDayOne] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const trackInstall = useCallback(
    (eventName: InstallEventName, platform: InstallPlatform) => {
      void saveOnboardingEvent({
        data: { token: readStoredToken(), eventName, platform },
      }).catch(() => undefined);
    },
    [saveOnboardingEvent],
  );

  useEffect(() => {
    let cancelled = false;
    // A missing local token is still valid: an authorized return-link session
    // cookie from the emailed link can carry access on another browser.
    const token = readStoredToken();
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
  }, [loadHub]);

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <p className="text-sm text-muted-foreground">Loading your plan...</p>
      </div>
    );
  }

  if (status === "denied" || !hub) return <AccessDenied />;

  const completedCount = hub.completedDays.filter((d) => hub.days.some((x) => x.day === d)).length;
  const current = currentAssignmentDay(hub.days, hub.completedDays);
  const currentEntry = current ? hub.days.find((d) => d.day === current) : null;
  const currentTiming = current ? planDayTiming(hub.calendar, current) : null;
  const pct = Math.round((completedCount / TOTAL_ASSIGNMENTS) * 100);

  async function openDayOne() {
    if (startingDayOne) return;
    setStartingDayOne(true);
    setStartError(null);
    try {
      const result = await recordDayOneStart({ data: { token: readStoredToken() } });
      if (!result.ok) {
        setStartError("We could not start Day 1. Refresh your plan and try again.");
        return;
      }
      await navigate({ to: "/your-plan/day/$day", params: { day: "1" } });
    } catch {
      setStartError("We could not start Day 1. Try again.");
    } finally {
      setStartingDayOne(false);
    }
  }

  async function openPlanUpdate() {
    if (updatingPlan) return;
    setUpdatingPlan(true);
    setUpdateError(null);
    try {
      if ((await beginUpdate({ data: { token: readStoredToken() } })).ok) {
        window.localStorage.removeItem("gxj_assessment_draft_v1");
        await navigate({ to: "/assessment/start" });
      } else {
        setUpdateError("We couldn't open setup. Try again.");
      }
    } catch {
      setUpdateError("We couldn't open setup. Try again.");
    } finally {
      setUpdatingPlan(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">Your Plan</p>
      <h1 className="gxj-display-title mt-2 text-2xl leading-tight tracking-tight sm:text-3xl">
        {hub.firstName}, Here&rsquo;s What To Do Next
      </h1>
      <p className="mt-3 text-sm font-medium">
        {completedCount} of {TOTAL_ASSIGNMENTS} days complete
      </p>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-[2px] bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL_ASSIGNMENTS}
        aria-valuenow={completedCount}
        aria-label="Plan progress"
      >
        <div className="h-full bg-gxj-teal" style={{ width: `${pct}%` }} />
      </div>

      {completedCount === TOTAL_ASSIGNMENTS ? (
        <SevenDayNextStep />
      ) : (
        <InstallNudge track={trackInstall} />
      )}
      {completedCount === TOTAL_ASSIGNMENTS && hub.planVersionId ? (
        <section className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Want to Repeat Your 7-Day Plan?</h2>
          <p className="mt-2 text-sm">
            Your completed week stays saved. Start another week with the same workouts whenever
            you're ready.
          </p>
          {!confirmRestart ? (
            <Button variant="outline" className="mt-4" onClick={() => setConfirmRestart(true)}>
              Restart My 7-Day Plan
            </Button>
          ) : (
            <div className="mt-4">
              <p className="text-sm">
                Start a new week today? Your active progress will begin again at Day 1.
              </p>
              <Button
                className="mt-3"
                disabled={restarting}
                onClick={async () => {
                  if (restarting || !hub.planVersionId) return;
                  setRestarting(true);
                  setStartError(null);
                  try {
                    const attempt = await getSubmissionAttempt({
                      restartVersion: hub.planVersionId,
                    });
                    const result = await restart({
                      data: {
                        token: readStoredToken(),
                        retryToken: attempt.raw,
                        expectedVersion: hub.planVersionId,
                        submissionId: attempt.submissionId,
                        sessionTokenHash: attempt.hash,
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                      },
                    });
                    if (!result.ok) {
                      setStartError("Your plan changed. Refresh My Plan before restarting.");
                      return;
                    }
                    try {
                      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, attempt.raw);
                    } catch {
                      /* server cookie carries access */
                    }
                    window.location.assign("/your-plan");
                  } catch {
                    setStartError("We couldn't restart your plan. Try again.");
                  } finally {
                    setRestarting(false);
                  }
                }}
              >
                {restarting ? "Starting..." : "Yes - Start a New Week"}
              </Button>
              <Button
                variant="outline"
                className="ml-3"
                disabled={restarting}
                onClick={() => setConfirmRestart(false)}
              >
                Keep My Completed Plan
              </Button>
            </div>
          )}
          {startError ? (
            <p className="mt-3 text-sm" role="alert">
              {startError}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Link to="/your-plan" hash="current" className="underline-offset-4 hover:underline">
          Today
        </Link>
        <Link to="/your-plan" hash="schedule" className="underline-offset-4 hover:underline">
          Schedule
        </Link>
        <Link to="/your-plan" hash="guidance" className="underline-offset-4 hover:underline">
          Plan Tips
        </Link>
        {completedCount < TOTAL_ASSIGNMENTS ? (
          <button
            type="button"
            className="underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setConfirmUpdate(true);
              setUpdateError(null);
            }}
          >
            Change My Answers
          </button>
        ) : null}
      </div>

      {completedCount < TOTAL_ASSIGNMENTS && confirmUpdate ? (
        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm leading-relaxed">
            Changing your answers will rebuild this plan and reset your progress.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="outline" disabled={updatingPlan} onClick={() => void openPlanUpdate()}>
              {updatingPlan ? "Opening..." : "Continue"}
            </Button>
            <Button
              variant="ghost"
              disabled={updatingPlan}
              onClick={() => {
                setConfirmUpdate(false);
                setUpdateError(null);
              }}
            >
              Keep My Plan
            </Button>
          </div>
          {updateError ? (
            <p role="alert" className="mt-3 text-sm">
              {updateError}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Current workout */}
      <section
        id="current"
        className={`mt-8 scroll-mt-6 rounded-lg border border-border p-4 ${
          currentEntry ? "bg-card" : "bg-gxj-mint"
        }`}
      >
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          {currentEntry && currentTiming
            ? planDayHeading(currentEntry, currentTiming)
            : "Plan Complete"}
        </h2>
        {currentEntry ? (
          <>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Day {currentEntry.day} &middot; {assignmentKind(currentEntry)}
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">{currentEntry.title}</h3>
            {currentEntry.minutes ? (
              <p className="mt-1 text-xs text-muted-foreground">
                About {currentEntry.minutes} minutes
              </p>
            ) : null}
            {currentEntry.description ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {currentEntry.description}
              </p>
            ) : null}
            {currentEntry.optional ? (
              <div className="mt-3 rounded-md border border-dashed border-border p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Optional Active Recovery
                </p>
                <p className="mt-1 text-sm font-medium">{currentEntry.optional.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {currentEntry.optional.description}
                </p>
              </div>
            ) : null}
            {currentEntry.day === 1 ? (
              <Button
                size="lg"
                className="mt-4 w-full sm:w-auto"
                disabled={startingDayOne}
                onClick={openDayOne}
              >
                {startingDayOne ? "Starting..." : "Start Day 1"}
              </Button>
            ) : (
              <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
                <Link to="/your-plan/day/$day" params={{ day: String(currentEntry.day) }}>
                  Open Day {currentEntry.day} Details
                </Link>
              </Button>
            )}
            {startError ? (
              <p role="alert" className="mt-2 text-xs font-medium leading-relaxed">
                {startError}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">7-Day Plan Complete</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You finished all seven days in this plan. Review any day below whenever you want.
            </p>
          </>
        )}
      </section>

      {/* Schedule */}
      <section id="schedule" className="mt-8 scroll-mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Your 7-Day Schedule</h2>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {hub.days.map((d) => {
            const complete = hub.completedDays.includes(d.day);
            const isCurrent = d.day === current;
            const timing = planDayTiming(hub.calendar, d.day);
            const status = complete
              ? "Complete"
              : !isCurrent
                ? "Upcoming"
                : timing.relation === "today"
                  ? "Today"
                  : timing.relation === "tomorrow"
                    ? "Tomorrow"
                    : timing.relation === "past"
                      ? "Next"
                      : "Upcoming";
            return (
              <li key={d.day} className={isCurrent ? "bg-gxj-mint" : "bg-muted/30"}>
                <RowLink day={d.day}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      Day {d.day}: {d.title}
                    </h3>
                    <span
                      className={`shrink-0 text-[10px] uppercase tracking-widest ${
                        isCurrent ? "font-semibold text-gxj-teal" : "text-muted-foreground"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                </RowLink>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Plan tips */}
      <section id="guidance" className="mt-8 scroll-mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Tips for This Plan</h2>

        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Protein Target For This 7-Day Plan
          </h3>
          {hub.protein.grams !== null ? (
            <>
              <p className="mt-1.5 text-lg font-semibold tracking-tight">
                Aim for {hub.protein.grams} grams per day
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
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A simple way to get there is to build three or four meals or eating times around a
                solid protein source. Aim for roughly 30-40 grams each time, then adjust based on
                your bodyweight target.
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed">
                Protein first. Before you build the rest of the meal, decide where the protein is
                coming from.
              </p>
            </>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            How to Approach the Workouts
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Work hard, but go at your own pace. Rest when needed. Do fewer reps or use a smaller
            range of motion if necessary. Skip anything you can’t do safely, and stop if you feel
            pain.
          </p>
        </div>
      </section>
    </div>
  );
}
