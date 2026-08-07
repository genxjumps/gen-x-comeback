// Consent-state dispatch contracts, proven through the real production
// dispatchers and the real store fence semantics.
//
// No test-only consent model is used: every case seeds real LeadRow / EmailJobRow
// state and runs the production dispatch code paths. No provider is used and no
// email is ever sent: the fake adapter records requests in memory.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  dispatchFinalRescueJobs,
  dispatchHalfwayJobs,
  dispatchPlanCompletedJobs,
  dispatchPlanReadyJobs,
  dispatchRecoveryJobs,
  dispatchStalledJobs,
  dispatchStartDayOneJobs,
} from "@/lib/email/dispatch";
import {
  isProactiveJobType,
  PROACTIVE_JOB_TYPES,
  type EmailAdapter,
  type EmailJobRow,
  type EmailSendRequest,
  type LeadRow,
} from "@/lib/email/types";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";
import { RECOVER_CONSENT_DISCLOSURE, RECOVER_GENERIC_RESPONSE } from "@/routes/recover";

const NOW = new Date("2026-02-01T12:00:00.000Z");

function fakeAdapter(sent: EmailSendRequest[]): EmailAdapter {
  return {
    key: "fake",
    async send(request) {
      sent.push(request);
      return {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: `fake-${sent.length}`,
        acceptedAt: NOW.toISOString(),
      };
    },
  };
}

function baseDeps(store: MemoryStore, sent: EmailSendRequest[]) {
  return {
    store,
    adapter: fakeAdapter(sent),
    now: () => NOW,
    appOrigin: "https://app.genxjumps.com",
    fromEmail: "todd@genxjumps.com",
    fromName: "Todd from Gen X Jumps",
    replyTo: "todd@genxjumps.com",
    deriveCredential: (purpose: string, planVersionId: string, scope?: string) =>
      `${purpose}-${planVersionId}-${scope ?? "none"}`.padEnd(43, "x").slice(0, 43),
    hash: async (raw: string) => `hash-${raw}`,
  };
}

const sendableResolution = { action: "SEND" as const };

/** Runs the real dispatcher for one lead/job pair and returns its outcomes. */
async function runProactive(
  store: MemoryStore,
  sent: EmailSendRequest[],
  jobType: string,
): Promise<string[]> {
  const deps = baseDeps(store, sent);
  const loaderState = {
    action: "SEND" as const,
    firstName: "Todd",
    completedDays: [1, 2, 3, 4],
    requiredDays: [1, 2, 3, 4, 5, 6, 7],
  };
  const withLoaders = {
    ...deps,
    loadStartDayOneState: async () => ({ ...sendableResolution, ...loaderState }) as never,
    loadHalfwayState: async () => ({ ...sendableResolution, ...loaderState }) as never,
    loadStalledState: async () => ({ ...sendableResolution, ...loaderState }) as never,
    loadFinalRescueState: async () => ({ ...sendableResolution, ...loaderState }) as never,
    loadPlanCompletedState: async () => ({ ...sendableResolution, ...loaderState }) as never,
  };

  const summary =
    jobType === "plan_ready"
      ? await dispatchPlanReadyJobs(deps)
      : jobType === "start_day_1"
        ? await dispatchStartDayOneJobs(withLoaders as never)
        : jobType === "halfway"
          ? await dispatchHalfwayJobs(withLoaders as never)
          : jobType === "stalled"
            ? await dispatchStalledJobs(withLoaders as never)
            : jobType === "final_rescue"
              ? await dispatchFinalRescueJobs(withLoaders as never)
              : await dispatchPlanCompletedJobs(withLoaders as never);
  return summary.outcomes.map((o) => o.outcome);
}

function seed(store: MemoryStore, lead: LeadRow, job: Partial<EmailJobRow>): void {
  store.leads.set(lead.id, lead);
  const row = makeJob({ lead_plan_id: lead.id, plan_version_id: lead.plan_version_id, ...job });
  store.jobs.set(row.job_id, { ...row });
  if (lead.email_suppression_reason) {
    store.suppressions.set(lead.email_normalized, lead.email_suppression_reason);
  }
}

describe("Plan-email consent gates production proactive dispatch", () => {
  it("cancels every proactive lifecycle send while Plan consent is withdrawn", async () => {
    for (const jobType of PROACTIVE_JOB_TYPES) {
      const store = createMemoryStore(() => NOW);
      const sent: EmailSendRequest[] = [];
      seed(store, makeLead({ plan_email_consent_active: false }), {
        job_type: jobType,
        job_id: `job-${jobType}`,
      });
      expect(await runProactive(store, sent, jobType), jobType).toEqual(["canceled"]);
      expect(sent, jobType).toHaveLength(0);
      expect(store.jobs.get(`job-${jobType}`)?.status, jobType).toBe("canceled");
    }
  });

  it("cancels every pre-boundary proactive job shape after a Recovery re-consent", async () => {
    const lead = makeLead({ plan_email_consent_at: NOW.toISOString() });
    const stale = [
      { label: "pending", status: "pending" as const },
      { label: "retry_scheduled", status: "retry_scheduled" as const, next_attempt_at: null },
      {
        label: "expired_processing",
        status: "processing" as const,
        lease_expires_at: "2026-01-31T00:00:00.000Z",
      },
      { label: "overdue", status: "pending" as const, eligible_at: "2026-01-02T00:00:00.000Z" },
      {
        label: "future_dated",
        status: "pending" as const,
        eligible_at: "2026-03-01T00:00:00.000Z",
      },
    ];

    for (const variant of stale) {
      const store = createMemoryStore(() => NOW);
      const sent: EmailSendRequest[] = [];
      const { label, ...jobFields } = variant;
      seed(store, lead, {
        job_id: `stale-${label}`,
        // Created BEFORE the current Plan consent boundary.
        created_at: "2026-01-10T00:00:00.000Z",
        eligible_at: "2026-01-10T00:00:00.000Z",
        ...jobFields,
      });
      expect(await runProactive(store, sent, "plan_ready"), label).toEqual(["canceled"]);
      expect(sent, label).toHaveLength(0);
      expect(store.jobs.get(`stale-${label}`)?.status, label).toBe("canceled");
    }
  });

  it("sends a qualifying job created at or after the current consent boundary", async () => {
    const store = createMemoryStore(() => NOW);
    const sent: EmailSendRequest[] = [];
    seed(store, makeLead({ plan_email_consent_at: "2026-02-01T11:00:00.000Z" }), {
      created_at: "2026-02-01T11:55:00.000Z",
      eligible_at: "2026-02-01T11:55:00.000Z",
    });
    expect(await runProactive(store, sent, "plan_ready")).toEqual(["provider_accepted"]);
    expect(sent).toHaveLength(1);
  });

  it("blocks proactive and Recovery sending on hard bounce and complaint", async () => {
    for (const reason of ["hard_bounce", "complaint"]) {
      const lead = makeLead({
        email_suppression_reason: reason,
        email_suppressed_at: NOW.toISOString(),
      });

      const recoveryStore = createMemoryStore(() => NOW);
      const recoverySent: EmailSendRequest[] = [];
      seed(recoveryStore, lead, {
        job_id: "recovery-1",
        job_type: "recovery",
        template_version: "recovery_v1",
        idempotency_key: "recovery:version-1:req-1:v1",
      });
      const recoverySummary = await dispatchRecoveryJobs(baseDeps(recoveryStore, recoverySent));
      expect(recoverySummary.outcomes.map((o) => o.outcome)).toEqual(["suppressed"]);
      expect(recoverySent).toHaveLength(0);

      const store = createMemoryStore(() => NOW);
      const sent: EmailSendRequest[] = [];
      seed(store, lead, {});
      expect(await runProactive(store, sent, "plan_ready")).toEqual(["suppressed"]);
      expect(sent).toHaveLength(0);
    }
  });

  it("never consent-gates the transactional Recovery job type", async () => {
    expect(isProactiveJobType("recovery")).toBe(false);
    for (const jobType of PROACTIVE_JOB_TYPES) expect(isProactiveJobType(jobType)).toBe(true);

    // Withdrawn Plan consent still allows the user-requested Recovery email.
    const store = createMemoryStore(() => NOW);
    const sent: EmailSendRequest[] = [];
    seed(store, makeLead({ plan_email_consent_active: false }), {
      job_id: "recovery-2",
      job_type: "recovery",
      template_version: "recovery_v1",
      idempotency_key: "recovery:version-1:req-2:v1",
    });
    const summary = await dispatchRecoveryJobs(baseDeps(store, sent));
    expect(summary.outcomes.map((o) => o.outcome)).toEqual(["provider_accepted"]);
    expect(sent).toHaveLength(1);
  });
});

describe("final provider-attempt fence", () => {
  /** Deps whose store mutates consent state between the read and the fence. */
  function racing(
    store: MemoryStore,
    sent: EmailSendRequest[],
    mutate: (lead: LeadRow) => LeadRow,
  ) {
    const deps = baseDeps(store, sent);
    return {
      ...deps,
      store: {
        ...store,
        recordFirstProviderAttempt: async (
          jobId: string,
          claimToken: string | null,
          attemptedAt: string,
        ) => {
          // The consent boundary moves AFTER the dispatcher's earlier read.
          const job = store.jobs.get(jobId);
          if (job) {
            const lead = store.leads.get(job.lead_plan_id);
            if (lead) store.leads.set(lead.id, mutate(lead));
          }
          return store.recordFirstProviderAttempt(jobId, claimToken, attemptedAt);
        },
      },
    };
  }

  it("refuses the provider call when Plan consent is withdrawn after the earlier read", async () => {
    const store = createMemoryStore(() => NOW);
    const sent: EmailSendRequest[] = [];
    seed(store, makeLead(), {});
    const summary = await dispatchPlanReadyJobs(
      racing(store, sent, (lead) => ({ ...lead, plan_email_consent_active: false })) as never,
    );
    expect(summary.outcomes.map((o) => o.outcome)).toEqual(["canceled"]);
    expect(sent).toHaveLength(0);
    expect(store.jobs.get("job-1")?.status).toBe("canceled");
  });

  it("refuses the provider call when the consent boundary moves past the job after the earlier read", async () => {
    const store = createMemoryStore(() => NOW);
    const sent: EmailSendRequest[] = [];
    seed(store, makeLead(), { created_at: "2026-02-01T11:59:00.000Z" });
    const summary = await dispatchPlanReadyJobs(
      racing(store, sent, (lead) => ({
        ...lead,
        plan_email_consent_at: "2026-02-01T11:59:30.000Z",
      })) as never,
    );
    expect(summary.outcomes.map((o) => o.outcome)).toEqual(["canceled"]);
    expect(sent).toHaveLength(0);
    expect(store.jobs.get("job-1")?.first_provider_attempt_at).toBeNull();
  });

  it("still reports lost_lease and never sends when the lease is stolen at the fence", async () => {
    const store = createMemoryStore(() => NOW);
    const sent: EmailSendRequest[] = [];
    seed(store, makeLead(), {});
    const deps = baseDeps(store, sent);
    const summary = await dispatchPlanReadyJobs({
      ...deps,
      store: {
        ...store,
        recordFirstProviderAttempt: async (
          jobId: string,
          claimToken: string | null,
          attemptedAt: string,
        ) => {
          store.stealLease(jobId);
          return store.recordFirstProviderAttempt(jobId, claimToken, attemptedAt);
        },
      },
    } as never);
    expect(summary.outcomes.map((o) => o.outcome)).toEqual(["lost_lease"]);
    expect(sent).toHaveLength(0);
    expect(store.jobs.get("job-1")?.first_provider_attempt_at).toBeNull();
  });

  it("keeps the recorded first-attempt boundary immutable across retries", async () => {
    const store = createMemoryStore(() => NOW);
    const sent: EmailSendRequest[] = [];
    seed(store, makeLead(), { first_provider_attempt_at: "2026-01-31T00:00:00.000Z" });
    await runProactive(store, sent, "plan_ready");
    expect(store.jobs.get("job-1")?.first_provider_attempt_at).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("Recovery route surface", () => {
  it("renders the exact consent disclosure beneath the Recovery action", () => {
    expect(RECOVER_CONSENT_DISCLOSURE).toBe(
      "By recovering your plan, you agree to receive Gen X Jumps 7-Day Plan emails.",
    );
    const source = readFileSync("src/routes/recover.ts", "utf8");
    const form = source.slice(source.indexOf("Send My Link"));
    expect(form).toContain("RECOVER_CONSENT_DISCLOSURE");
  });

  it("keeps one generic non-enumerating response for every request outcome", () => {
    const source = readFileSync("src/routes/recover.ts", "utf8");
    expect(source.match(/return genericAcknowledgement\(\);/g)?.length).toBeGreaterThanOrEqual(5);
    expect(RECOVER_GENERIC_RESPONSE).toBe(
      "If that email matches a Gen X Jumps plan, a new link is on the way.",
    );
  });
});
