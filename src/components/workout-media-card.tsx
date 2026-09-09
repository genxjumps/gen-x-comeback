import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Check, Play, RotateCw } from "lucide-react";
import { missingVideoNotice, workoutVideoPoster, workoutVideoSrc } from "@/lib/workout-videos";

type WorkoutCardState =
  | { type: "blocked"; previousDay: number; availableLabel: string }
  | { type: "scheduled"; availableLabel: string }
  | { type: "ready" }
  | { type: "completed" };

const WORKOUT_COVERS: Partial<Record<number, string>> = {
  1: "/workout-covers/day-01.webp",
  2: "/workout-covers/day-02.webp",
  3: "/workout-covers/day-03.webp",
  4: "/workout-covers/day-04.webp",
  5: "/workout-covers/day-05.webp",
  6: "/workout-covers/day-06.webp",
  7: "/workout-covers/day-07.webp",
};

function StatusTitle({ children }: { children: React.ReactNode }) {
  return <span className="gxj-display-title text-xl leading-none sm:text-2xl">{children}</span>;
}

/**
 * Branded workout cover with a live status rail. The fixed artwork identifies
 * the plan day; availability, navigation, and playback remain real app state.
 */
export function WorkoutMediaCard({
  dayNumber,
  code,
  title,
  coverTitle = title,
  state,
}: {
  dayNumber: number;
  code: string;
  title: string;
  coverTitle?: string;
  state: WorkoutCardState;
}) {
  const [playing, setPlaying] = useState(false);
  const src = workoutVideoSrc(code);
  const cover = WORKOUT_COVERS[dayNumber] ?? workoutVideoPoster(code);
  const [coverTitleFirstLine, coverTitleSecondLine] = coverTitle.split(" + ", 2);

  return (
    <section
      className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm"
      aria-label={`Day ${dayNumber} workout video`}
    >
      <div className="aspect-video overflow-hidden bg-muted">
        {src && playing ? (
          <iframe
            src={src}
            loading="lazy"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
            title={`${code} - ${title}`}
          />
        ) : cover ? (
          <div className="relative h-full w-full">
            <img src={cover} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-y-0 left-0 flex w-[57%] flex-col justify-center px-[5%] text-foreground">
              <p className="gxj-display-title text-[clamp(0.5rem,1.7vw,0.75rem)] uppercase tracking-[0.18em]">
                Day {dayNumber} / Workout
              </p>
              <h2 className="gxj-display-title mt-[3%] text-[clamp(1.45rem,5.8vw,3.25rem)] leading-[0.94] uppercase tracking-[-0.02em]">
                {coverTitleFirstLine}
                {coverTitleSecondLine ? (
                  <>
                    <br />+ {coverTitleSecondLine}
                  </>
                ) : null}
              </h2>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4">
            <p className="text-center text-sm text-muted-foreground">{missingVideoNotice(code)}</p>
          </div>
        )}
      </div>

      {state.type === "blocked" ? (
        <div className="flex min-h-20 items-center justify-between gap-4 bg-card px-4 py-3 sm:px-5">
          <div>
            <StatusTitle>Complete Day {state.previousDay} First</StatusTitle>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Available {state.availableLabel}
            </p>
          </div>
          <Link
            to="/your-plan/day/$day"
            params={{ day: String(state.previousDay) }}
            className="gxj-display-title flex shrink-0 items-center gap-2 text-base leading-none underline-offset-4 hover:underline sm:text-lg"
          >
            Go to Day {state.previousDay}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </div>
      ) : state.type === "scheduled" ? (
        <div className="flex min-h-20 items-center justify-between gap-4 bg-card px-4 py-3 sm:px-5">
          <div>
            <StatusTitle>Available {state.availableLabel}</StatusTitle>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Your next workout is scheduled.
            </p>
          </div>
          <CalendarDays className="size-8 shrink-0" strokeWidth={2.25} aria-hidden="true" />
        </div>
      ) : state.type === "ready" ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          disabled={playing}
          className="flex min-h-20 w-full items-center justify-between gap-4 bg-gxj-orange px-4 py-3 text-left text-white transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white disabled:cursor-default disabled:hover:brightness-100 sm:px-5"
          aria-label={playing ? "Workout video is open" : `Start Day ${dayNumber} workout`}
        >
          <StatusTitle>{playing ? "Workout Open" : "Start Workout"}</StatusTitle>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-gxj-orange">
            <Play className="size-5 fill-current" aria-hidden="true" />
          </span>
        </button>
      ) : (
        <div className="flex min-h-20 items-center justify-between gap-4 bg-card px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="size-6" strokeWidth={3} aria-hidden="true" />
            </span>
            <StatusTitle>Completed</StatusTitle>
          </div>
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="gxj-display-title flex shrink-0 items-center gap-2 text-base leading-none underline-offset-4 hover:underline sm:text-lg"
          >
            Replay Workout
            <RotateCw className="size-6" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
