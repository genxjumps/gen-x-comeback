// Dispatch endpoint authorization. Server-only.
//
// Production authorization is unchanged: `Authorization: Bearer
// EMAIL_DISPATCH_SECRET`, compared in constant time over equal-length digests.
//
// A second, strictly staging-only credential is accepted ONLY when the server
// environment sets EMAIL_FAKE_STAGING_ENABLED=true AND a separate
// EMAIL_STAGING_DISPATCH_SECRET is configured. Request input alone can never
// select the staging mode.
import { createHash, timingSafeEqual } from "node:crypto";
import { readFakeStagingConfig } from "@/lib/email/staging-config.server";

export type DispatchMode = "production" | "fake_staging";

/** Constant-time compare over equal-length digests (raw lengths never leak). */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer[ ]+(.+)$/.exec(header.trim());
  if (!match) return null;
  const provided = match[1]!.trim();
  return provided.length > 0 ? provided : null;
}

/** Returns the authorized dispatch mode, or null when unauthorized. */
export function authorizeDispatch(request: Request): DispatchMode | null {
  const provided = bearer(request);
  if (!provided) return null;

  const production = process.env["EMAIL_DISPATCH_SECRET"];
  if (typeof production === "string" && production.trim().length > 0) {
    if (secretsMatch(provided, production.trim())) return "production";
  }

  const staging = readFakeStagingConfig();
  if (staging.enabled && staging.dispatchSecret) {
    if (secretsMatch(provided, staging.dispatchSecret)) return "fake_staging";
  }

  return null;
}

/**
 * Fake staging requires a JSON body carrying exactly one synthetic
 * `lead_plan_id` UUID. Anything else is rejected before any job is claimed.
 */
export async function readStagingLeadPlanId(request: Request): Promise<string | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>)["lead_plan_id"];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid.test(trimmed) ? trimmed.toLowerCase() : null;
}
