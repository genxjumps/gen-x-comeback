import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, LockKeyhole, Play, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceleratorDayAccessForDays,
  type AcceleratorDay,
  type AcceleratorWeek,
} from "@/lib/accelerator/program";
import {
  completeAcceleratorDay,
  getAcceleratorHub,
  saveAcceleratorCheckIn,
} from "@/lib/accelerator/functions";
import type { AcceleratorHubData } from "@/lib/accelerator/types";

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

function DayStatusIcon({ access }: { access: "completed" | "current" | "locked" }) {
  if (access === "completed") return <Check aria-hidden="true" className="size-3.5" />;
  if (access === "locked") return <LockKeyhole aria-hidden="true" className="size-3.5" />;
  return <Play aria-hidden="true" className="size-3.5" />;
}

function MediaPlaceholder({ day, label }: { day: AcceleratorDay; label: string }) {
  return (
    <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 px-6 text-center">
      {day.kind === "rest" ? null : (
        <Video aria-hidden="true" className="size-8 text-muted-foreground" />
      )}
      <p className="mt-3 text-sm font-semibold">
        {day.kind === "rest" ? "No workout video today" : `${label} video placeholder`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {day.kind === "rest"
          ? "Acknowledge the rest day to continue"
          : "Cloudflare Stream ID pending"}
      </p>
    </div>
  );
}

export function AcceleratorProgram() {
  const loadHub = useServerFn(getAcceleratorHub);
  const completeDay = useServerFn(completeAcceleratorDay);
  const saveCheckIn = useServerFn(saveAcceleratorCheckIn);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [hub, setHub] = useState<AcceleratorHubData | null>(null);
  const [displayWeek, setDisplayWeek] = useState<AcceleratorWeek>(1);
  const [savingDay, setSavingDay] = useState(false);
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [notes, setNotes] = useState("");

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
        const completed = result.data.completedDays.length;
        setHub(result.data);
        setDisplayWeek(completed >= 28 ? 4 : ((Math.floor(completed / 7) + 1) as AcceleratorWeek));
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
    const saved = hub?.checkIns.find((checkIn) => checkIn.week === displayWeek);
    setWeight(saved ? String(saved.weight.value) : "");
    setWaist(saved ? String(saved.waist.value) : "");
    setNotes(saved?.notes ?? "");
  }, [displayWeek, hub?.checkIns]);

  const daysWithAccess = useMemo(
    () => (hub ? acceleratorDayAccessForDays(hub.snapshot.days, new Set(hub.completedDays)) : []),
    [hub],
  );
  const currentDay = daysWithAccess.find((day) => day.access === "current") ?? null;
  const displayedDays = daysWithAccess.filter((day) => day.week === displayWeek);

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <p className="text-sm text-muted-foreground">Loading your program...</p>
      </div>
    );
  }
  if (status === "denied" || !hub) return <PrivateAccessDenied />;

  const completedCount = hub.completedDays.length;
  const progressPercent = Math.round((completedCount / hub.snapshot.days.length) * 100);
  const focus = hub.snapshot.weekFocus.find(({ week }) => week === displayWeek)!;
  const currentLabel = currentDay ? hub.snapshot.assignments[currentDay.assignment].label : null;
  const checkInUnlocked = completedCount >= (displayWeek - 1) * 7;

  async function markCurrentComplete() {
    if (!currentDay || savingDay) return;
    setSavingDay(true);
    setMessage(null);
    try {
      const result = await completeDay({ data: { day: currentDay.day } });
      if (!result.ok) {
        setMessage("That day couldn't be saved. Reload the program and try again.");
        return;
      }
      setHub((previous) =>
        previous ? { ...previous, completedDays: result.completedDays } : previous,
      );
      const nextWeek =
        result.completedDays.length >= 28
          ? 4
          : ((Math.floor(result.completedDays.length / 7) + 1) as AcceleratorWeek);
      setDisplayWeek(nextWeek);
      setMessage(result.newlyCompleted ? "Progress saved." : "That day was already saved.");
    } catch {
      setMessage("That day couldn't be saved. Try again.");
    } finally {
      setSavingDay(false);
    }
  }

  async function submitCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkInUnlocked || savingCheckIn) return;
    const weightValue = Number(weight);
    const waistValue = Number(waist);
    if (!(weightValue > 0) || !(waistValue > 0)) {
      setMessage("Enter both weight and waist measurements.");
      return;
    }

    setSavingCheckIn(true);
    setMessage(null);
    try {
      const result = await saveCheckIn({
        data: {
          week: displayWeek,
          weight: { value: weightValue, unit: "lb" },
          waist: { value: waistValue, unit: "in" },
          notes,
        },
      });
      if (!result.ok) {
        setMessage("That check-in isn't available yet or couldn't be saved.");
        return;
      }
      setHub((previous) =>
        previous
          ? {
              ...previous,
              checkIns: [
                ...previous.checkIns.filter((item) => item.week !== result.checkIn.week),
                result.checkIn,
              ].sort((a, b) => a.week - b.week),
            }
          : previous,
      );
      setMessage(`Week ${displayWeek} check-in saved.`);
    } catch {
      setMessage("That check-in couldn't be saved. Try again.");
    } finally {
      setSavingCheckIn(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
          28-Day Fat Loss Accelerator
        </p>
        <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight sm:text-4xl">
          {currentDay ? `Day ${currentDay.day}: ${currentLabel}` : "You Finished"}
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

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div>
          {currentDay && currentLabel ? (
            <section aria-labelledby="today-title">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
                Today&rsquo;s assignment
              </p>
              <h2 id="today-title" className="mt-1 text-xl font-semibold tracking-tight">
                {currentLabel}
              </h2>
              <div className="mt-4">
                <MediaPlaceholder day={currentDay} label={currentLabel} />
              </div>
              <Button
                type="button"
                size="lg"
                className="mt-4 w-full"
                disabled={savingDay}
                onClick={markCurrentComplete}
              >
                {savingDay
                  ? "Saving..."
                  : currentDay.kind === "primary_workout"
                    ? `Mark Day ${currentDay.day} Complete`
                    : `Acknowledge Day ${currentDay.day}`}
              </Button>
            </section>
          ) : (
            <section className="rounded-lg border border-border bg-gxj-mint p-6">
              <h2 className="text-xl font-semibold tracking-tight">28-Day Program Complete</h2>
            </section>
          )}

          {message ? <p className="mt-3 text-sm font-medium">{message}</p> : null}

          <section className="mt-10" aria-labelledby="schedule-title">
            <h2 id="schedule-title" className="text-xl font-semibold tracking-tight">
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
              {displayedDays.map((day) => (
                <li key={day.day} className={day.access === "current" ? "bg-gxj-mint" : "bg-card"}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-7 items-center justify-center rounded-full border border-border">
                      <DayStatusIcon access={day.access} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        Day {day.day}: {hub.snapshot.assignments[day.assignment].label}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">{day.access}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Week {displayWeek} Coaching
            </p>
            <h2 className="mt-1 text-lg font-semibold">{focus.title}</h2>
            <div className="mt-3 flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/60 px-4 text-center">
              <p className="text-xs text-muted-foreground">Weekly coaching video placeholder</p>
            </div>
          </section>

          <form className="rounded-lg border border-border bg-card p-4" onSubmit={submitCheckIn}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Week {displayWeek} Check-In
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-medium">
                Weight - lb
                <Input
                  className="mt-1"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={weight}
                  disabled={!checkInUnlocked}
                  onChange={(event) => setWeight(event.target.value)}
                />
              </label>
              <label className="text-xs font-medium">
                Waist - in
                <Input
                  className="mt-1"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={waist}
                  disabled={!checkInUnlocked}
                  onChange={(event) => setWaist(event.target.value)}
                />
              </label>
            </div>
            <label className="mt-3 block text-xs font-medium">
              Progress notes - optional
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={1000}
                value={notes}
                disabled={!checkInUnlocked}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <Button
              type="submit"
              size="sm"
              className="mt-3 w-full"
              disabled={!checkInUnlocked || savingCheckIn}
            >
              {savingCheckIn ? "Saving..." : "Save Check-In"}
            </Button>
            {!checkInUnlocked ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Complete the previous week to unlock this check-in.
              </p>
            ) : null}
          </form>

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
    </main>
  );
}
