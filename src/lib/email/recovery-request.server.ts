// Server-trusted recovery request identity and privacy-preserving bucket keys.
// Server-only. Uses the existing EMAIL_TOKEN_SECRET_V1 key material, so no new
// configuration is introduced.
//
// A bare hidden UUID in a public form is client-tamperable, so the submitted
// request id is an opaque signed value: `{id}.{hmac}`. Only a value this server
// issued verifies, and replaying the same verified value reproduces the same
// logical recovery idempotency key, which makes the submission idempotent.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Opaque 32-byte base64url request id, matching the app's token alphabet. */
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{43}$/;

function sign(secret: string, requestId: string): string {
  return createHmac("sha256", secret)
    .update(`gxj:v1:recovery_request:${requestId}`, "utf8")
    .digest("base64url");
}

/** Issues a fresh server-trusted request id for one rendered recovery form. */
export function issueRecoveryRequestId(secret: string): string {
  const requestId = randomBytes(32).toString("base64url");
  return `${requestId}.${sign(secret, requestId)}`;
}

/**
 * Verifies a submitted signed request id and returns the bare request id, or
 * null for anything this server did not issue. Comparison is constant-time.
 */
export function verifyRecoveryRequestId(secret: string, submitted: unknown): string | null {
  if (typeof submitted !== "string" || submitted.length > 200) return null;
  const parts = submitted.split(".");
  if (parts.length !== 2) return null;
  const [requestId, signature] = parts as [string, string];
  if (!REQUEST_ID_RE.test(requestId)) return null;

  const expected = Buffer.from(sign(secret, requestId), "utf8");
  const provided = Buffer.from(signature, "utf8");
  if (expected.length !== provided.length) return null;
  return timingSafeEqual(expected, provided) ? requestId : null;
}

/**
 * Keyed, privacy-preserving rate-limit bucket for a normalized email address.
 * The raw address is never part of the returned key.
 */
export function recoveryEmailBucketKey(secret: string, emailNormalized: string): string {
  const digest = createHmac("sha256", secret)
    .update(`gxj:v1:recovery_email_bucket:${emailNormalized}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return `recover_email:${digest}`;
}

/** Trims and lowercases a submitted address. Returns null when unusable. */
export function normalizeSubmittedEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value.length === 0 || value.length > 254) return null;
  if (!/^[^\s@,;:<>"()[\]\\]+@[^\s@.,;:<>"()[\]\\]+(\.[^\s@.,;:<>"()[\]\\]+)+$/.test(value)) {
    return null;
  }
  return value;
}
