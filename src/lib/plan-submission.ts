// Client-side submit identity helpers: a stable idempotency key for one
// submission, plus locally generated access credentials whose raw values never
// leave this browser except in the single save request.
import { generateAccessToken, hashAccessToken } from "@/lib/lead-plan";

const SUBMISSION_STORAGE_KEY = "gxj_submission_v1";

/** Order-insensitive canonical JSON so answer comparison is stable. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Returns the submission id for these exact answers, creating one only when the
 * answers change. A retry of the same submit therefore replays exactly.
 */
export function getSubmissionId(answers: unknown): string {
  const fingerprint = canonical(answers);
  try {
    const stored = window.localStorage.getItem(SUBMISSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { fingerprint?: unknown; id?: unknown };
      if (parsed.fingerprint === fingerprint && typeof parsed.id === "string") return parsed.id;
    }
  } catch {
    /* fall through to a fresh id */
  }
  const id = crypto.randomUUID();
  try {
    window.localStorage.setItem(SUBMISSION_STORAGE_KEY, JSON.stringify({ fingerprint, id }));
  } catch {
    /* ignore storage errors */
  }
  return id;
}

export type BrowserCredential = { raw: string; hash: string };

/** Mints a raw credential locally and returns it with its SHA-256 hash. */
export async function mintCredential(): Promise<BrowserCredential> {
  const raw = generateAccessToken();
  return { raw, hash: await hashAccessToken(raw) };
}
