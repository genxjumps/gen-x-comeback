const VISUAL_REVIEW_SESSION_KEY = "gxj_visual_review_v1";

export function isVisualReviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname.startsWith("id-preview--") && hostname.endsWith(".lovable.app");
}

export function beginVisualReview(): boolean {
  if (!isVisualReviewHost()) return false;
  try {
    window.sessionStorage.setItem(VISUAL_REVIEW_SESSION_KEY, "1");
  } catch {
    // Session storage is optional. The host check still prevents production use.
  }
  return true;
}

export function isVisualReviewMode(): boolean {
  if (!isVisualReviewHost()) return false;
  try {
    return window.sessionStorage.getItem(VISUAL_REVIEW_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
