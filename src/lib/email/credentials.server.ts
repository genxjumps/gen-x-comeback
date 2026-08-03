// Deterministic email credential derivation. Server-only.
//
// Return links and preference links must be byte-identical across retries of
// the same job, otherwise a retried send would hand the reader a second live
// credential. Deriving them with a keyed HMAC over the plan version makes
// every attempt for one plan version produce exactly the same credential,
// while a new plan version produces a fresh, unrelated one.
import { createHmac } from "node:crypto";

export type CredentialPurpose = "open_plan" | "email_preferences";

/** Rotatable key id. A future secret gets its own suffix, never a reuse. */
export const EMAIL_TOKEN_SECRET_ENV = "EMAIL_TOKEN_SECRET_V1";

/**
 * 43-char base64url credential (32 bytes), matching the opaque token format the
 * rest of the app already validates.
 */
export function deriveEmailCredential(
  secret: string,
  purpose: CredentialPurpose,
  planVersionId: string,
): string {
  return createHmac("sha256", secret)
    .update(`gxj:v1:${purpose}:${planVersionId}`, "utf8")
    .digest("base64url");
}

export function readEmailTokenSecret(): string | null {
  const value = process.env[EMAIL_TOKEN_SECRET_ENV];
  return typeof value === "string" && value.trim().length >= 32 ? value.trim() : null;
}
