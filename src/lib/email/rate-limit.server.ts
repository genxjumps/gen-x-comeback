// Shared best-effort abuse throttle for unauthenticated public HTML routes.
// Server-only. Counters live in the database so every worker shares them.
import { createHash } from "node:crypto";

export type RateLimitDecision = { allowed: boolean };

/** Coarse, privacy-preserving caller key: never stores a raw IP address. */
export function callerBucketKey(scope: string, request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip =
    forwarded.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const digest = createHash("sha256").update(`${scope}:${ip}`, "utf8").digest("hex").slice(0, 32);
  return `${scope}:${digest}`;
}

/**
 * Consumes one attempt from a fixed window. Fails open on infrastructure
 * errors so a counter outage can never lock a reader out of their own plan.
 */
export async function consumeRateLimit(
  bucketKey: string,
  windowSeconds: number,
  limit: number,
): Promise<RateLimitDecision> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
      p_bucket: bucketKey,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    });
    if (error) return { allowed: true };
    return { allowed: data !== false };
  } catch {
    return { allowed: true };
  }
}
