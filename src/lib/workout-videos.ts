// Real configured workout video assets, keyed by workout code.
// Only codes with a REAL configured asset appear here. Everything else renders
// an explicit internal-beta placeholder. Never invent or reuse another code's asset.
import { W01_IFRAME_SRC } from "@/lib/w01-content";

export const WORKOUT_VIDEOS: Record<string, string> = {
  W01: W01_IFRAME_SRC,
};

/** Real iframe src for a workout code, or null when no asset is connected. */
export function workoutVideoSrc(code: string | null | undefined): string | null {
  if (!code) return null;
  return WORKOUT_VIDEOS[code] ?? null;
}

/** Explicit internal-beta notice for a workout code with no connected asset. */
export function missingVideoNotice(code: string): string {
  return `${code} video asset not connected yet.`;
}
