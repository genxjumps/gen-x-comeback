import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, LockKeyhole, Play, RotateCcw } from "lucide-react";

import { AcceleratorCompletion } from "@/components/accelerator-completion";
import { Button } from "@/components/ui/button";
import { missedDayMessage } from "@/lib/accelerator/daily-assignment";
import {
  completeAcceleratorDay,
  getAcceleratorHub,
  undoAcceleratorDay,
} from "@/lib/accelerator/functions";
import { measurementSummary } from "@/lib/accelerator/measurements";
import {
  acceleratorDayAccessForDays,
  type AcceleratorDay,
  type AcceleratorDayAccess,
  type AcceleratorWeek,
} from "@/lib/accelerator/program";
import type { AcceleratorHubData, CustomerMeasurement } from "@/lib/accelerator/types";
import { acceleratorVideoSrc } from "@/lib/accelerator/video";

type DisplayDay = AcceleratorDay & { access: AcceleratorDayAccess };

function PrivateAccessDenied() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="gxj-display-title text-2xl leading-tight tracking-tight sm:text-3xl">
        This Program Is Private
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We couldn&rsquo;t confirm paid-program access from this browser. Public enrollment is still
        closed.
      </p>
    </div>
  );
}

function DayStatusIcon({ access }: { access: AcceleratorDayAccess }) {
  if (access === "completed") return <Check aria-hidden="true" className="size-3.5" />;
  if (access === "locked") return <LockKeyhole aria-hidden="true" className="size-3.5" />;
  return <Play aria-hidden="true" className="size-3.5" />;
}

function formatRuntime(runtimeSeconds: number | null | undefined): string {
  if (!runtimeSeconds) return "Runtime pending";
  const minutes = Math.floor(runtimeSeconds / 60);
  const seconds = runtimeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function MediaSlot({
  day,
  label,
  cloudflareStreamUid,
  access,
}: {
  day: AcceleratorDay;
  label: string;
  cloudflareStreamUid: string | null;
  access: AcceleratorDayAccess;
}) {
  if (day.kind === "rest") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 px-6 text-center">
        <p className="text-sm font-semibold">No workout video today</p>
        <p className="mt-1 text-xs text-muted-foreground">Take the full recovery day.</p>
      </div>
    );
  }
  if (access === "locked") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-border bg-muted/60 px-6 text-center">
        <LockKeyhole aria-hidden="true" className="size-7 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">Video unlocks with this workout</p>
        <p className="mt-1 text-xs text-muted-foreground">
          You can preview the instructions below.
        </p>
      </div>
    );
  }
  const src = acceleratorVideoSrc(cloudflareStreamUid);
  if (src) {
    return (
      <div className="aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        <iframe
          src={src}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
          title={`Day ${day.day} - ${label}`}
        />
      </div>
    );
  }
  return (
    <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 px-6 text-center">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">Cloudflare Stream video pending</p>
    </div>
  );
}

function friendlyDate(value: string | null): string {
  if (!value) return "your next calendar day";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function AcceleratorProgram() {
  const loadHub = useServerFn(getAcceleratorHub);
  const completeDay = useServerFn(completeAcceleratorDay);
  const undoDay = useServerFn(undoAcceleratorDay);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [hub, setHub] = useState<AcceleratorHubData | null>(null);
  const [displayWeek, setDisplayWeek] = useState<AcceleratorWeek>(1);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);
  const [justCompletedDay, setJustCompletedDay] = useState<number | null>(null);
  const [savingDay, setSavingDay] = useState(false);
  const [savingUndo, setSavingUndo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await loadHub({ data: {} });
        if (cancelled) return;
        if (!result.ok) {
          setStatus("denied");
          return;
        }
        const current = result.data.progress.currentDay;
        const currentWeek = current
          ? result.data.snapshot.days.find(({ day }) => day === current)?.week
          : 4;
        setHub(result.data);
        setDisplayWeek(currentWeek ?? 4);
        if (
          result.data.progress.undoDay &&
          result.data.progress.undoUntil &&
          Date.parse(result.data.progress.undoUntil) > Date.now()
        )
          setJustCompletedDay(result.data.progress.undoDay);
        setStatus("allowed");
      } catch {
        if (!cancelled) setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHub]);

  useEffect(() => {
    const undoUntil = hub?.progress.undoUntil;
    if (!undoUntil) return;
    const remaining = Date.parse(undoUntil) - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setClock(Date.now()), remaining + 100);
    return () => window.clearTimeout(timer);
  }, [hub?.progress.undoUntil]);

  const daysWithAccess = useMemo<DisplayDay[]>(
    () =>
      hub
        ? acceleratorDayAccessForDays(hub.snapshot.days, new Set(hub.completedDays)).map((day) =>
            day.access === "current" && !hub.progress.canCompleteCurrent
              ? { ...day, access: "locked" as const }
              : day,
          )
        : [],
    [hub],
  );

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <p className="text-sm text-muted-foreground">Loading your program...</p>
      </div>
    );
  }
  if (status === "denied" || !hub) return <PrivateAccessDenied />;
  const loadedHub = hub;

  const completedCount = hub.completedDays.length;
  const progressPercent = Math.round((completedCount / hub.snapshot.days.length) * 100);
  const nextDay = hub.progress.currentDay
    ? (daysWithAccess.find(({ day }) => day === hub.progress.currentDay) ?? null)
    : null;
  const actionableDay =
    hub.runStatus === "active" && hub.progress.canCompleteCurrent ? nextDay : null;
  const selectedDay = selectedDayNumber
    ? (daysWithAccess.find(({ day }) => day === selectedDayNumber) ?? null)
    : (actionableDay ?? nextDay ?? daysWithAccess.at(-1) ?? null);
  const displayedDays = daysWithAccess.filter((day) => day.week === displayWeek);
  const selectedDetails = selectedDay ? hub.snapshot.assignments[selectedDay.assignment] : null;
  const selectedContent = selectedDay
    ? hub.snapshot.assignmentContent[selectedDay.assignment]
    : null;
  const selectedRuntime = formatRuntime(selectedContent?.media?.runtimeSeconds);
  const focus = hub.snapshot.weekFocus.find(({ week }) => week === displayWeek)!;
  const coachingWeek = selectedDay?.week ?? displayWeek;
  const coaching = hub.snapshot.weeklyCoaching.find(({ week }) => week === coachingWeek);
  const coachingSrc = acceleratorVideoSrc(coaching?.media.cloudflareStreamUid);
  const hasFinalMeasurement = Boolean(
    hub.measurementSummary.runFinal.weight || hub.measurementSummary.runFinal.waist,
  );
  const canUndo = Boolean(
    !hasFinalMeasurement &&
    hub.progress.undoDay &&
    hub.progress.undoUntil &&
    Date.parse(hub.progress.undoUntil) > clock,
  );
  const returnMessage = missedDayMessage(hub.progress.daysWaiting);
  const latestWeight = hub.measurementSummary.globalLatest.weight;
  const latestWaist = hub.measurementSummary.globalLatest.waist;

  let pageTitle = "You Finished";
  if (hub.progress.programCompleted) pageTitle = "Accelerator Complete";
  else if (justCompletedDay) pageTitle = `Day ${justCompletedDay} Complete`;
  else if (hub.runStatus === "paused") pageTitle = "Your Accelerator Is Paused";
  else if (actionableDay)
    pageTitle = `Day ${actionableDay.day}: ${hub.snapshot.assignments[actionableDay.assignment].label}`;
  else if (nextDay)
    pageTitle = `Day ${nextDay.day} unlocks ${friendlyDate(hub.progress.availableOn)}`;

  async function markCurrentComplete() {
    if (!actionableDay || savingDay) return;
    setSavingDay(true);
    setMessage(null);
    try {
      const result = await completeDay({
        data: { enrollmentId: loadedHub.enrollmentId, day: actionableDay.day },
      });
      if (!result.ok) {
        setMessage("That day couldn't be saved. Reload the program and try again.");
        return;
      }
      setHub((previous) =>
        previous
          ? {
              ...previous,
              runStatus: result.progress.programCompleted ? "completed" : previous.runStatus,
              completedDays: result.completedDays,
              progress: result.progress,
            }
          : previous,
      );
      setClock(Date.now());
      setJustCompletedDay(actionableDay.day);
      setSelectedDayNumber(null);
      const nextWeek =
        result.completedDays.length >= 28
          ? 4
          : ((Math.floor(result.completedDays.length / 7) + 1) as AcceleratorWeek);
      setDisplayWeek(nextWeek);
      if (!result.newlyCompleted) setMessage("That day was already saved.");
    } catch {
      setMessage("That day couldn't be saved. Try again.");
    } finally {
      setSavingDay(false);
    }
  }

  async function undoLastCompletion() {
    const day = loadedHub.progress.undoDay;
    if (!day || !canUndo || savingUndo) return;
    setSavingUndo(true);
    setMessage(null);
    try {
      const result = await undoDay({ data: { enrollmentId: loadedHub.enrollmentId, day } });
      if (!result.ok) {
        setMessage("The Undo window has ended. Your saved progress is unchanged.");
        return;
      }
      setHub((previous) =>
        previous
          ? {
              ...previous,
              runStatus: "active",
              completedDays: result.completedDays,
              progress: result.progress,
            }
          : previous,
      );
      setJustCompletedDay(null);
      setSelectedDayNumber(day);
      const reopened = loadedHub.snapshot.days.find((entry) => entry.day === day);
      if (reopened) setDisplayWeek(reopened.week);
      setMessage(`Day ${day} reopened.`);
    } catch {
      setMessage("The day couldn't be reopened. Reload the program and try again.");
    } finally {
      setSavingUndo(false);
    }
  }

  function openScheduleDay(day: DisplayDay) {
    setSelectedDayNumber(day.day);
    setJustCompletedDay(null);
    setDisplayWeek(day.week);
    setMessage(null);
  }

  function addSavedMeasurement(measurement: CustomerMeasurement) {
    setHub((previous) => {
      if (!previous) return previous;
      const measurements = [
        measurement,
        ...previous.measurements.filter(({ id }) => id !== measurement.id),
      ];
      return {
        ...previous,
        measurements,
        measurementSummary: measurementSummary(measurements, previous.enrollmentId),
      };
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header>
        <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
          28-Day Fat Loss Accelerator
        </p>
        <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight sm:text-4xl">
          {pageTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hub.firstName}, you&rsquo;ve completed {completedCount} of 28 days. Missed time never
          skips your place.
        </p>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-[2px] bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={28}
          aria-valuenow={completedCount}
          aria-label="Accelerator progress"
        >
          <div className="h-full bg-gxj-teal" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      {returnMessage && actionableDay ? (
        <p className="mt-5 rounded-lg border border-border bg-gxj-mint p-4 text-sm leading-relaxed">
          {returnMessage}
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div>
          {hub.progress.programCompleted ? (
            <AcceleratorCompletion
              hub={hub}
              canUndo={canUndo}
              savingUndo={savingUndo}
              onUndo={() => void undoLastCompletion()}
              onMeasurementSaved={addSavedMeasurement}
            />
          ) : justCompletedDay ? (
            <section className="rounded-lg border border-border bg-gxj-mint p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
                Progress saved
              </p>
              <h2 className="mt-2 text-xl font-semibold">Day {justCompletedDay} Complete</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{`Day ${hub.progress.currentDay} opens ${friendlyDate(hub.progress.availableOn)}.`}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/home">
                    Back to Home
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
                {canUndo ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingUndo}
                    onClick={() => void undoLastCompletion()}
                  >
                    <RotateCcw aria-hidden="true" className="size-4" />
                    {savingUndo ? "Reopening..." : "Undo"}
                  </Button>
                ) : null}
              </div>
            </section>
          ) : hub.runStatus === "paused" ? (
            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-xl font-semibold">This run is paused</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your progress is safe. Resume it from My Programs when you want this to become your
                active structured program again.
              </p>
              <Button asChild className="mt-5">
                <Link to="/my-programs">Open My Programs</Link>
              </Button>
            </section>
          ) : selectedDay && selectedDetails && selectedContent ? (
            <section aria-labelledby="workout-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
                    {selectedDay.access === "completed"
                      ? "Completed workout"
                      : selectedDay.day === hub.progress.currentDay
                        ? hub.progress.canCompleteCurrent
                          ? "Today's workout"
                          : "Next workout"
                        : "Locked preview"}
                  </p>
                  <h2 id="workout-title" className="mt-1 text-xl font-semibold tracking-tight">
                    Day {selectedDay.day}: {selectedDetails.label}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Week {selectedDay.week} - {selectedRuntime}
                </p>
              </div>

              <div className="mt-4">
                <MediaSlot
                  day={selectedDay}
                  label={selectedDetails.label}
                  cloudflareStreamUid={selectedContent.media?.cloudflareStreamUid ?? null}
                  access={selectedDay.access}
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Today's focus
                  </h3>
                  <p className="mt-2 text-sm font-semibold">{selectedDetails.focus}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Equipment
                  </h3>
                  <p className="mt-2 text-sm font-semibold">{hub.snapshot.equipment.program}</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-card p-4">
                <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Practical instructions
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {selectedContent.instructions}
                </p>
              </div>

              {selectedDay.day === hub.progress.currentDay && !hub.progress.canCompleteCurrent ? (
                <p className="mt-4 rounded-md border border-border bg-muted/50 p-4 text-sm">
                  This workout opens {friendlyDate(hub.progress.availableOn)}. Today&rsquo;s work is
                  already complete.
                </p>
              ) : null}
              {actionableDay?.day === selectedDay.day ? (
                <>
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Watching the video and completing the day are saved separately. Complete means
                    complete by your standard.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="mt-3 w-full"
                    disabled={savingDay}
                    onClick={() => void markCurrentComplete()}
                  >
                    {savingDay ? "Saving..." : `Complete Day ${selectedDay.day}`}
                  </Button>
                </>
              ) : null}
            </section>
          ) : (
            <section className="rounded-lg border border-border bg-gxj-mint p-6">
              <h2 className="text-xl font-semibold">28-Day Program Complete</h2>
            </section>
          )}

          {message ? <p className="mt-3 text-sm font-medium">{message}</p> : null}

          <section className="mt-10" aria-labelledby="schedule-title">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
              Four-week schedule
            </p>
            <h2 id="schedule-title" className="mt-1 text-xl font-semibold tracking-tight">
              Week {displayWeek}: {focus.title}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {hub.snapshot.weekFocus.map((week) => (
                <Button
                  key={week.week}
                  type="button"
                  variant={displayWeek === week.week ? "default" : "outline"}
                  onClick={() => setDisplayWeek(week.week)}
                >
                  Week {week.week}
                </Button>
              ))}
            </div>
            <ol className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {displayedDays.map((day) => {
                const isSelected = selectedDay?.day === day.day && !justCompletedDay;
                const statusLabel =
                  day.access === "completed"
                    ? "Completed - open again"
                    : day.day === hub.progress.currentDay && !hub.progress.canCompleteCurrent
                      ? `Opens ${friendlyDate(hub.progress.availableOn)}`
                      : day.access;
                return (
                  <li key={day.day} className={isSelected ? "bg-gxj-mint" : "bg-card"}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      aria-current={day.day === hub.progress.currentDay ? "step" : undefined}
                      onClick={() => openScheduleDay(day)}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border">
                        <DayStatusIcon access={day.access} />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">
                          Day {day.day}: {hub.snapshot.assignments[day.assignment].label}
                        </span>
                        <span className="block text-xs capitalize text-muted-foreground">
                          {statusLabel}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Week {coachingWeek} Coaching
            </p>
            <h2 className="mt-1 text-lg font-semibold">{coaching?.title ?? focus.title}</h2>
            {coachingSrc ? (
              <div className="mt-3 aspect-video overflow-hidden rounded-md border border-border bg-muted">
                <iframe
                  src={coachingSrc}
                  loading="lazy"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                  title={`Week ${coachingWeek} coaching`}
                />
              </div>
            ) : (
              <div className="mt-3 flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/60 px-4 text-center">
                <p className="text-xs text-muted-foreground">Coaching video pending recording</p>
              </div>
            )}
            {coaching ? (
              <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                {coaching.guidance.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Latest Measurements
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">Weight</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {latestWeight ? `${latestWeight.value} ${latestWeight.unit}` : "Not recorded"}
                </dd>
              </div>
              <div className="rounded-md bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">Waist</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {latestWaist ? `${latestWaist.value} ${latestWaist.unit}` : "Not recorded"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Your Nutrition Targets
            </p>
            <p className="mt-2 text-sm font-semibold">Formula pending</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Calories and protein remain intentionally uncalculated until the formula is approved.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
