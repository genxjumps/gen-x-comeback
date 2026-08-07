import { createHash } from "node:crypto";

export const PRODUCTION_DISPATCH_URL =
  "https://app.genxjumps.com/api/public/email/dispatch" as const;
export const SCHEDULER_INVOCATION_HEADER = "x-scheduler-invocation-id" as const;
export const SCHEDULER_TIMESTAMP_HEADER = "x-scheduler-timestamp" as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SchedulerAuthentication =
  | { ok: true; invocationId: string }
  | { ok: false; reason: "missing" | "invalid" | "stale" | "replayed" };

type SchedulerRejection = "missing" | "invalid" | "stale" | "replayed";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer[ ]+(.+)$/.exec(header.trim());
  if (!match) return null;
  const value = match[1]!.trim();
  return value.length > 0 ? value : null;
}

function secretDigest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function recordRejected(reference: string, reason: SchedulerRejection) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    await supabaseAdmin.rpc("record_email_scheduler_auth_attempt", {
      p_invocation_reference: reference,
      p_result: reason,
      p_attempted_at: new Date().toISOString(),
    });
  } catch {
    // Authentication remains fail-closed if telemetry is unavailable.
  }
}

/**
 * Authenticates one fresh scheduler invocation without persisting or logging the
 * bearer value. The database consumes the invocation id exactly once.
 */
export async function authenticateProductionScheduler(
  request: Request,
): Promise<SchedulerAuthentication> {
  const token = bearer(request);
  const invocationId = request.headers.get(SCHEDULER_INVOCATION_HEADER)?.trim() ?? "";
  const timestamp = request.headers.get(SCHEDULER_TIMESTAMP_HEADER)?.trim() ?? "";

  if (!token || !invocationId || !timestamp) {
    await recordRejected(invocationId || "missing", "missing");
    return { ok: false, reason: "missing" };
  }
  if (!UUID_RE.test(invocationId)) {
    await recordRejected("invalid", "invalid");
    return { ok: false, reason: "invalid" };
  }
  const parsedTimestamp = new Date(timestamp);
  if (!Number.isFinite(parsedTimestamp.getTime())) {
    await recordRejected(invocationId, "stale");
    return { ok: false, reason: "stale" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("authenticate_email_scheduler_invocation", {
    p_invocation_id: invocationId,
    p_secret_sha256: secretDigest(token),
    p_request_timestamp: parsedTimestamp.toISOString(),
    p_authenticated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, reason: "invalid" };
  if (data === "accepted") return { ok: true, invocationId: invocationId.toLowerCase() };
  if (data === "stale" || data === "replayed") return { ok: false, reason: data };
  return { ok: false, reason: "invalid" };
}

export type ProductionDispatchGate =
  | { enabled: true; activationBoundary: string; providerSubmissionLimit: number }
  | { enabled: false; reason: string; activationBoundary: string | null };

/** Database-owned production gate, independent from scheduler authentication. */
export async function readProductionDispatchGate(): Promise<ProductionDispatchGate> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("email_production_control")
    .select("sending_enabled, activation_boundary, provider_submission_limit")
    .eq("singleton_id", 1)
    .limit(1);
  if (error || !data?.[0]) {
    return { enabled: false, reason: "production_control_unavailable", activationBoundary: null };
  }
  const row = data[0];
  if (!row.sending_enabled) {
    return {
      enabled: false,
      reason: "production_send_disabled",
      activationBoundary: row.activation_boundary,
    };
  }
  if (!row.activation_boundary) {
    return { enabled: false, reason: "activation_boundary_missing", activationBoundary: null };
  }
  return {
    enabled: true,
    activationBoundary: row.activation_boundary,
    providerSubmissionLimit: row.provider_submission_limit,
  };
}

export async function countProductionEligibleJobs(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("count_production_eligible_email_jobs");
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export async function finishSchedulerInvocation(input: {
  invocationId: string;
  succeeded: boolean;
  sendingEnabled: boolean;
  claimedCount: number;
  eligibleJobsAfter: number;
  failureCode?: string | null;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("finish_email_scheduler_invocation", {
    p_invocation_id: input.invocationId,
    p_dispatch_succeeded: input.succeeded,
    p_sending_enabled: input.sendingEnabled,
    p_claimed_count: input.claimedCount,
    p_eligible_jobs_after: input.eligibleJobsAfter,
    p_failure_code: input.failureCode ?? undefined,
    p_completed_at: new Date().toISOString(),
  });
  if (error || data !== true) throw new Error("scheduler_invocation_evidence_not_completed");
}

/** Conservative rollback: preserve all evidence and close only the send gate. */
export async function disableProductionSending(reason: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("disable_email_production_sending", {
    p_reason: reason,
  });
  if (error || data !== true) throw new Error("production_send_rollback_failed");
}
