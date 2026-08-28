import type {
  MarketingAdapter,
  MarketingSyncJob,
  MarketingSyncStore,
  MarketingSyncSummary,
} from "@/lib/marketing/types";
import { MARKETING_SYNC_MAX_ATTEMPTS, MARKETING_SYNC_RETRY_DELAYS_MS } from "@/lib/marketing/types";

export type MarketingDispatchDeps = {
  store: MarketingSyncStore;
  adapter: MarketingAdapter;
  groupId: string;
  now: () => Date;
};

async function finishOrThrow(
  deps: MarketingDispatchDeps,
  job: MarketingSyncJob,
  input: Parameters<MarketingSyncStore["finish"]>[1],
) {
  if (!(await deps.store.finish(job, input))) throw new Error("marketing_sync_finish_lost_lease");
}

export async function dispatchMarketingSyncJobs(
  deps: MarketingDispatchDeps,
  options?: { limit?: number },
): Promise<MarketingSyncSummary> {
  const jobs = await deps.store.claimJobs(options?.limit ?? 5, 60);
  const summary: MarketingSyncSummary = {
    claimed: jobs.length,
    accepted: 0,
    retried: 0,
    failed: 0,
    suppressed: 0,
  };

  for (const job of jobs) {
    const lead = await deps.store.getLead(job.lead_plan_id);
    if (!lead) {
      await finishOrThrow(deps, job, {
        status: "failed_permanent",
        errorCode: "lead_not_found",
      });
      summary.failed += 1;
      continue;
    }

    const fence = await deps.store.beginAttempt(job);
    if (fence !== "ok") {
      if (fence === "lost_lease") continue;
      await finishOrThrow(deps, job, { status: "suppressed", errorCode: fence });
      summary.suppressed += 1;
      continue;
    }

    const result = await deps.adapter.upsertSubscriber({
      email: lead.email_normalized,
      firstName: lead.first_name,
      groupId: deps.groupId,
      consentAt: job.consent_at,
    });

    if (result.outcome === "accepted") {
      await finishOrThrow(deps, job, {
        status: "provider_accepted",
        subscriberId: result.subscriberId,
        acceptedAt: deps.now().toISOString(),
      });
      summary.accepted += 1;
      continue;
    }

    if (result.outcome === "permanent" || job.attempt_count >= MARKETING_SYNC_MAX_ATTEMPTS) {
      await finishOrThrow(deps, job, {
        status: "failed_permanent",
        errorCode: result.errorCode,
      });
      summary.failed += 1;
      continue;
    }

    const delayIndex = Math.min(job.attempt_count - 1, MARKETING_SYNC_RETRY_DELAYS_MS.length - 1);
    const scheduledDelay = MARKETING_SYNC_RETRY_DELAYS_MS[delayIndex]!;
    const delay = Math.max(scheduledDelay, result.retryAfterMs ?? 0);
    await finishOrThrow(deps, job, {
      status: "retry_scheduled",
      errorCode: result.errorCode,
      nextAttemptAt: new Date(deps.now().getTime() + delay).toISOString(),
    });
    summary.retried += 1;
  }

  return summary;
}
