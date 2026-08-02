// Real configured workout video assets, keyed by workout code.
// Only codes with a REAL configured asset appear here. Everything else renders
// an explicit internal-beta placeholder. Never invent or reuse another code's asset.
import { W01_IFRAME_SRC } from "@/lib/w01-content";

export const WORKOUT_VIDEOS: Record<string, string> = {
  W01: W01_IFRAME_SRC,
  W02: "https://customer-cvsfidz4ao4uk9i5.cloudflarestream.com/fde054dd829980dfe777791a3fa2f19f/iframe?poster=https%3A%2F%2Fcustomer-cvsfidz4ao4uk9i5.cloudflarestream.com%2Ffde054dd829980dfe777791a3fa2f19f%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600",
  W03: "https://customer-cvsfidz4ao4uk9i5.cloudflarestream.com/42c3d0fcca85e9bf8f242c20affe97bc/iframe?poster=https%3A%2F%2Fcustomer-cvsfidz4ao4uk9i5.cloudflarestream.com%2F42c3d0fcca85e9bf8f242c20affe97bc%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600",
  W04: "https://customer-cvsfidz4ao4uk9i5.cloudflarestream.com/2571c872aa65a66a95970585695aaf0f/iframe?poster=https%3A%2F%2Fcustomer-cvsfidz4ao4uk9i5.cloudflarestream.com%2F2571c872aa65a66a95970585695aaf0f%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600",
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
