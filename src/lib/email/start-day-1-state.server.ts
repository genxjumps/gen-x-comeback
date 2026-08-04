// Server-only authoritative state loader for the Start Day 1 resolver.
//
// Read-only: every query is a SELECT against persisted state. It never mutates
// rows, never records events, and never reads request, URL, or browser state.
import { INACTIVITY_JOB_TYPES, type StartDayOneJob, type StartDayOneState } from "@/lib/email/start-day-1-resolver";
import { PLAN_READY_JOB_TYPE } from "@/lib/email/types";

type Row = Record<string, unknown>;

type QueryClient = {
  from: (table: string) => {
    select: (columns: string) => QueryBuilder;
  };
};

type QueryBuilder = {
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: readonly unknown[]) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  limit: (count: number) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
};

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
 * Loads the authoritative persisted state for one claimed Start Day 1 job.
 * Accepts an injected client for tests; defaults to the service-role client.
 */
export async function loadStartDayOneState(
  job: StartDayOneJob,
  client?: QueryClient,
): Promise<StartDayOneState> {
  const db =
    client ??
    ((await import("@/integrations/supabase/client.server"))
      .supabaseAdmin as unknown as QueryClient);

  const [lead, starts, completions, planReadyJobs, lifecycleJobs] = await Promise.all([
    rows(
      db
        .from("lead_plans")
        .select("id, plan_version_id, email_original, marketing_unsubscribed_at, email_suppressed_at")
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
        .select("completed_at")
        .eq("lead_plan_id", job.lead_plan_id)
        .eq("day_number", 1)
        .limit(1),
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
        .select("job_type, provider_accepted_at")
        .eq("lead_plan_id", job.lead_plan_id)
        .eq("status", "provider_accepted")
        .order("provider_accepted_at", { ascending: false })
        .limit(100),
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

  const accepted = lifecycleJobs.filter(
    (row) => typeof row["provider_accepted_at"] === "string" && row["job_type"] !== PLAN_READY_JOB_TYPE,
  );

  const lastLifecycleAcceptedAt =
    accepted
      .map((row) => row["provider_accepted_at"] as string)
      .sort()
      .at(-1) ?? null;

  const acceptedInactivityCount = accepted.filter((row) =>
    (INACTIVITY_JOB_TYPES as readonly string[]).includes(String(row["job_type"])),
  ).length;

  return {
    job,
    currentPlanVersionId: str(leadRow, "plan_version_id"),
    hasRecipient: Boolean(recipient),
    marketingUnsubscribedAt: str(leadRow, "marketing_unsubscribed_at"),
    emailSuppressedAt: str(leadRow, "email_suppressed_at"),
    suppressionListed: suppressions.length > 0,
    dayOneStartedAt: str(starts[0], "started_at"),
    dayOneCompletedAt: str(completions[0], "completed_at"),
    planReadyAcceptedAt: str(planReadyJobs[0], "provider_accepted_at"),
    lastLifecycleAcceptedAt,
    acceptedInactivityCount,
  };
}

export type { QueryClient as StartDayOneQueryClient };
