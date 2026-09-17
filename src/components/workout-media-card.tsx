import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, RotateCw } from "lucide-react";

import { PuWorkoutMedia } from "@/design-system/precision/components";
import { missingVideoNotice, workoutVideoSrc } from "@/lib/workout-videos";

type WorkoutCardState =
  | { type: "blocked"; previousDay: number; availableLabel: string }
  | { type: "locked" }
  | { type: "scheduled"; availableLabel: string }
  | { type: "ready" }
  | { type: "completed" };

function mediaState(state: WorkoutCardState): "ready" | "completed" | "locked" | "scheduled" {
  if (state.type === "completed") return "completed";
  if (state.type === "scheduled") return "scheduled";
  if (state.type === "locked" || state.type === "blocked") return "locked";
  return "ready";
}

/**
 * Shared workout media surface. Playback remains live app behavior while the
 * resting artwork and access states come from the photo-free Precision Utility
 * workout-media system.
 */
export function WorkoutMediaCard({
  dayNumber,
  dayLabel,
  code,
  title,
  coverTitle = title,
  coverSrc,
  videoSrc,
  accent = "orange",
  artworkVariant = "seven-day",
  iframeTitle,
  state,
}: {
  dayNumber: number;
  dayLabel?: string;
  code: string;
  title: string;
  coverTitle?: string;
  coverSrc?: string;
  videoSrc?: string | null;
  accent?: "orange" | "aqua";
  artworkVariant?: "seven-day" | "accelerator";
  iframeTitle?: string;
  state: WorkoutCardState;
}) {
  const [playing, setPlaying] = useState(false);
  const src = videoSrc === undefined ? workoutVideoSrc(code) : videoSrc;
  const program = artworkVariant === "accelerator" ? "28-Day Accelerator" : "7-Day Plan";
  const subtitle =
    state.type === "blocked"
      ? `Complete Day ${state.previousDay} first · Available ${state.availableLabel}`
      : state.type === "scheduled"
        ? `Your next workout is scheduled. Available ${state.availableLabel}.`
        : !src
          ? missingVideoNotice(code)
          : dayLabel;

  // Kept for API compatibility while callers migrate away from image covers.
  void coverSrc;
  void accent;

  return (
    <section className="mt-6" aria-label={`Day ${dayNumber} workout video`}>
      {src && playing ? (
        <div className="aspect-video overflow-hidden rounded-[var(--pu-radius-contained)] bg-[var(--pu-media-surface-top)] shadow-[var(--pu-shadow-overlay)]">
          <iframe
            src={src}
            loading="lazy"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
            title={iframeTitle ?? `${code} - ${title}`}
          />
        </div>
      ) : (
        <PuWorkoutMedia
          program={program}
          workoutNumber={dayNumber}
          title={coverTitle}
          subtitle={subtitle}
          state={mediaState(state)}
          size="hero"
          actionLabel={`Start Day ${dayNumber} workout`}
          onAction={src ? () => setPlaying(true) : undefined}
        />
      )}

      {state.type === "blocked" ? (
        <div className="mt-3 flex min-h-12 items-center justify-between gap-4 border-t border-[var(--pu-border-subtle)] pt-3">
          <span className="text-sm text-[var(--pu-text-secondary)]">
            Available {state.availableLabel}
          </span>
          <Link
            to="/your-plan/day/$day"
            params={{ day: String(state.previousDay) }}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--pu-radius-control)] px-2 text-sm font-bold text-[var(--pu-text-primary)] underline-offset-4 hover:underline"
          >
            Go to Day {state.previousDay}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </div>
      ) : state.type === "completed" ? (
        <div className="mt-3 flex justify-end border-t border-[var(--pu-border-subtle)] pt-3">
          <button
            type="button"
            onClick={() => setPlaying(true)}
            disabled={!src}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--pu-radius-control)] px-2 text-sm font-bold text-[var(--pu-text-primary)] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-45"
          >
            Replay Workout
            <RotateCw className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
