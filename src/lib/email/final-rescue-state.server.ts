// Server-only authoritative state loader for the Final Rescue resolver.
//
// Read-only: every query is a SELECT against persisted state. It never mutates
// rows, never records events, and never reads request, URL, browser, provider
// open, or provider click state. No personal data beyond recipient presence is
// derived or returned.
import type { FinalRescueJob, FinalRescueState } from "@/lib/email/final-rescue-resolver";
import {
  FINAL_RESCUE_JOB_TYPE,
  HALFWAY_JOB_TYPE,
  PLAN_COMPLETED_JOB_TYPE,
  PLAN_READY_JOB_TYPE,
} from "@/lib/email/types";
import { INACTIVITY_JOB_TYPES } from "@/lib/email/start-day-1-resolver";
import { requiredDayNumbers } from "@/lib/email/halfway-state.server";
import type { StartDayOneQueryClient } from "@/lib/email/start-day-1-state.server";

type Row = Record<string, unknown>;

async function rows(promise: Promise<{ data: Row[] | null; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data ?? [];
}

function str(row: Row | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Syntactic deliverability check for a persisted recipient address.
 * The address itself is never returned, logged, or included in state.
 */
const EMAIL_PATTERN = /^[^\s@,;:<>"()[\]\\]+@[^\s@.,;:<>"()[\]\\]+(\.[^\s@.,;:<>"()[\]\\]+)+$/;

function isValidRecipient(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 254 && EMAIL_PATTERN.test(trimmed);
}

/** Unsent states: a job in any of these still controls the lifecycle gap. */
const UNSENT_STATUSES = ["pending", "processing", "retry_scheduled"] as const;

/**
 * Loads the authoritative persisted state for one claimed Final Rescue job.
 * Accepts an injected client for tests; defaults to the service-role client.
 */
export async function loadFinalRescueState(
  job: FinalRescueJob,
  client?: StartDayOneQueryClient,
): Promise<FinalRescueState> {
  const db =
    client ??
    ((await import("@/integrations/supabase/client.server"))
      .supabaseAdmin as unknown as StartDayOneQueryClient);

  const [lead, starts, completions, planReadyJobs, lifecycleJobs, planCompletedJobs, halfwayJobs] =
    await Promise.all([
      rows(
        db
          .from("lead_plans")
          .select(
            "id, plan_version_id, plan_json, email_original, email_normalized, marketing_unsubscribed_at, email_suppressed_at",
          )
          .eq("id", job.lead_plan_id)
          .limit(1),
      ),
      rows(
        db
          .from("lead_plan_day_starts")
          .select("started_at")
          .eq("plan_version_id", job.plan_version_id)
          .eq("day_number", 1)
          .limit(1),
      ),
      rows(
        db
          .from("lead_plan_day_completions")
          .select("day_number, completed_at")
          .eq("lead_plan_id", job.lead_plan_id)
          .order("day_number", { ascending: true })
          .limit(100),
      ),
      rows(
        db
          .from("email_jobs")
          .select("provider_accepted_at")
          .eq("plan_version_id", job.plan_version_id)
          .eq("job_type", PLAN_READY_JOB_TYPE)
          .eq("status", "provider_accepted")
          .order("provider_accepted_at", { ascending: false })
          .limit(1),
      ),
      rows(
        db
          .from("email_jobs")
          .select("job_id, job_type, provider_accepted_at")
          .eq("lead_plan_id", job.lead_plan_id)
          // Caps are per plan version: reassessment history must not carry over.
          .eq("plan_version_id", job.plan_version_id)
          .eq("status", "provider_accepted")
          .order("provider_accepted_at", { ascending: false })
          .limit(100),
      ),
      // Plan Completed control is presence-only, in any state, with no tie-breaker.
      rows(
        db
          .from("email_jobs")
          .select("job_id")
          .eq("plan_version_id", job.plan_version_id)
          .eq("job_type", PLAN_COMPLETED_JOB_TYPE)
          .limit(1),
      ),
      rows(
        db
          .from("email_jobs")
          .select("job_id, status")
          .eq("plan_version_id", job.plan_version_id)
          .eq("job_type", HALFWAY_JOB_TYPE)
          .in("status", UNSENT_STATUSES)
          .limit(1),
      ),
    ]);

  const leadRow = lead[0];
  const emailNormalized = str(leadRow, "email_normalized");
  const recipient = str(leadRow, "email_original");

  const suppressions = emailNormalized
    ? await rows(
        db
          .from("email_suppressions")
          .select("reason")
          .eq("email_normalized", emailNormalized)
          .limit(1),
      )
    : [];

  const required = requiredDayNumbers(leadRow?.["plan_json"]);
  const requiredRows = completions.filter((row) => {
    const value = row["day_number"];
    return typeof value === "number" && required.includes(value);
  });

  const accepted = lifecycleJobs.filter(
    (row) =>
      typeof row["provider_accepted_at"] === "string" && row["job_type"] !== PLAN_READY_JOB_TYPE,
  );

  const lastLifecycleAcceptedAt =
    accepted
      // Only this job's own acceptance is excluded from the shared 24-hour gap.
      .filter((row) => row["job_id"] !== job.job_id)
      .map((row) => row["provider_accepted_at"] as string)
      .sort()
      .at(-1) ?? null;

  const acceptedInactivityCount = accepted.filter((row) =>
    (INACTIVITY_JOB_TYPES as readonly string[]).includes(String(row["job_type"])),
  ).length;

  const finalRescueAcceptedAt =
    accepted
      .filter((row) => row["job_type"] === FINAL_RESCUE_JOB_TYPE)
      .map((row) => row["provider_accepted_at"] as string)
      .sort()
      .at(-1) ?? null;

  return {
    job,
    currentPlanVersionId: str(leadRow, "plan_version_id"),
    hasRecipient: isValidRecipient(recipient),
    marketingUnsubscribedAt: str(leadRow, "marketing_unsubscribed_at"),
    emailSuppressedAt: str(leadRow, "email_suppressed_at"),
    suppressionListed: suppressions.length > 0,
    planComplete: required.length > 0 && requiredRows.length >= required.length,
    planCompletedControl: planCompletedJobs.length > 0,
    halfwayPending: halfwayJobs.length > 0,
    finalRescueAcceptedAt,
    dayOneStartedAt: str(starts[0], "started_at"),
    requiredCompletions: requiredRows.length,
    totalRequiredAssignments: required.length,
    planReadyAcceptedAt: str(planReadyJobs[0], "provider_accepted_at"),
    lastLifecycleAcceptedAt,
    acceptedInactivityCount,
  };
}

/**
 * Read-only lookup of the authoritative Final Rescue control state for one plan
 * version, used by the lower-priority Start Day 1 and Stalled loaders.
 *
 * Returns the acceptance time of Final Rescue, if any, and the eligibility
 * horizon of the single unsent Final Rescue job, if one exists.
 */
export async function loadFinalRescueControl(
  planVersionId: string,
  db: StartDayOneQueryClient,
): Promise<{ finalRescueAcceptedAt: string | null; finalRescueDueAt: string | null }> {
  const [acceptedJobs, unsentJobs] = await Promise.all([
    rows(
      db
        .from("email_jobs")
        .select("provider_accepted_at")
        .eq("plan_version_id", planVersionId)
        .eq("job_type", FINAL_RESCUE_JOB_TYPE)
        .eq("status", "provider_accepted")
        .order("provider_accepted_at", { ascending: false })
        .limit(1),
    ),
    rows(
      db
        .from("email_jobs")
        .select("eligible_at")
        .eq("plan_version_id", planVersionId)
        .eq("job_type", FINAL_RESCUE_JOB_TYPE)
        .in("status", UNSENT_STATUSES)
        .order("eligible_at", { ascending: true })
        .limit(1),
    ),
  ]);

  return {
    finalRescueAcceptedAt: str(acceptedJobs[0], "provider_accepted_at"),
    finalRescueDueAt: str(unsentJobs[0], "eligible_at"),
  };
}
