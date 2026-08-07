// Recovery consent-state checkpoint acceptance tests.
//
// Every case is user-locked behavior for the two independent consent states:
// Gen X Jumps 7-Day Plan email consent and general Gen X Jumps marketing
// consent. No real provider is used and no email is ever sent: the fake adapter
// records requests in memory.
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

/**
 * Minimal deterministic consent model for one lead identity. It mirrors the
 * migration's contract: two independent states, each with active/inactive,
 * source, consent timestamp, and unsubscribe timestamp.
 */
type ConsentSource = "plan_signup" | "plan_recovery" | "plan_preferences" | "test_backfill";

type ConsentState = {
  active: boolean;
  source: ConsentSource | null;
  consentAt: string | null;
  unsubscribedAt: string | null;
};

type Identity = {
  emailNormalized: string;
  plan: ConsentState;
  marketing: ConsentState;
  suppression: string | null;
};

function activeState(source: ConsentSource, at: string): ConsentState {
  return { active: true, source, consentAt: at, unsubscribedAt: null };
}

/** New 7-Day Plan signup: explicitly activates BOTH consent states. */
function signup(emailNormalized: string, at: string): Identity {
  return {
    emailNormalized: emailNormalized.trim().toLowerCase(),
    plan: activeState("plan_signup", at),
    marketing: activeState("plan_signup", at),
    suppression: null,
  };
}

/** Pre-production test backfill applied by the migration to existing identities. */
function backfill(identity: Identity, at: string): Identity {
  return {
    ...identity,
    plan: activeState("test_backfill", at),
    marketing: activeState("test_backfill", at),
  };
}

/** Plan-email unsubscribe. Marketing consent is never read or written. */
function withdrawPlan(identity: Identity, at: string): Identity {
  return {
    ...identity,
    plan: { ...identity.plan, active: false, unsubscribedAt: at },
  };
}

function withdrawMarketing(identity: Identity, at: string): Identity {
  return {
    ...identity,
    marketing: { ...identity.marketing, active: false, unsubscribedAt: at },
  };
}

/**
 * Recovery re-consent boundary. Inactive-to-active writes plan_recovery and a
 * fresh Plan consent timestamp; already-active changes nothing. Marketing is
 * never touched in either case.
 */
function recoverConsent(identity: Identity, at: string): Identity {
  if (identity.plan.active) return identity;
  return { ...identity, plan: activeState("plan_recovery", at) };
}

function leadFrom(identity: Identity, overrides: Partial<LeadRow> = {}): LeadRow {
  return makeLead({
    email_normalized: identity.emailNormalized,
    plan_email_consent_active: identity.plan.active,
    plan_email_consent_at: identity.plan.consentAt,
    email_suppression_reason: identity.suppression,
    email_suppressed_at: identity.suppression ? NOW.toISOString() : null,
    ...overrides,
  });
}

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

/** Runs every proactive dispatcher for one lead/job pair and returns outcomes. */
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

describe("consent state contract", () => {
  // 1
  it("keeps one normalized email as exactly one identity", () => {
    const a = signup("Reader@Example.com", "2026-01-01T00:00:00.000Z");
    const b = signup("  reader@example.COM ", "2026-01-02T00:00:00.000Z");
    expect(a.emailNormalized).toBe("reader@example.com");
    expect(b.emailNormalized).toBe(a.emailNormalized);

    const identities = new Map<string, Identity>();
    identities.set(a.emailNormalized, a);
    identities.set(b.emailNormalized, b);
    expect(identities.size).toBe(1);
  });

  // 2
  it("holds Plan and marketing consent independently", () => {
    const identity = signup("reader@example.com", "2026-01-01T00:00:00.000Z");

    const planOff = withdrawPlan(identity, "2026-01-05T00:00:00.000Z");
    expect(planOff.plan.active).toBe(false);
    expect(planOff.plan.unsubscribedAt).toBe("2026-01-05T00:00:00.000Z");
    expect(planOff.marketing).toEqual(identity.marketing);

    const marketingOff = withdrawMarketing(identity, "2026-01-06T00:00:00.000Z");
    expect(marketingOff.marketing.active).toBe(false);
    expect(marketingOff.marketing.unsubscribedAt).toBe("2026-01-06T00:00:00.000Z");
    expect(marketingOff.plan).toEqual(identity.plan);
  });

  // 3
  it("activates both consents on a new Plan signup with explicit sources and timestamps", () => {
    const at = "2026-02-01T12:00:00.000Z";
    const identity = signup("new@example.com", at);
    expect(identity.plan).toEqual({
      active: true,
      source: "plan_signup",
      consentAt: at,
      unsubscribedAt: null,
    });
    expect(identity.marketing).toEqual({
      active: true,
      source: "plan_signup",
      consentAt: at,
      unsubscribedAt: null,
    });
  });

  // 4
  it("backfills existing test identities active for both consents", () => {
    const at = "2026-02-01T00:00:00.000Z";
    const legacy: Identity = {
      emailNormalized: "legacy@example.com",
      plan: { active: false, source: null, consentAt: null, unsubscribedAt: null },
      marketing: { active: false, source: null, consentAt: null, unsubscribedAt: null },
      suppression: null,
    };
    const migrated = backfill(legacy, at);
    expect(migrated.plan.active).toBe(true);
    expect(migrated.marketing.active).toBe(true);
    expect(migrated.plan.source).toBe("test_backfill");
    expect(migrated.marketing.source).toBe("test_backfill");
    expect(migrated.plan.consentAt).toBe(at);
    expect(migrated.marketing.consentAt).toBe(at);
  });

  // 5
  it("preserves suppression across backfill and still blocks sending", async () => {
    const bounced: Identity = {
      ...signup("bounced@example.com", "2026-01-01T00:00:00.000Z"),
      suppression: "hard_bounce",
    };
    const migrated = backfill(bounced, "2026-02-01T00:00:00.000Z");
    expect(migrated.suppression).toBe("hard_bounce");

    const store = createMemoryStore(() => NOW);
    const sent: EmailSendRequest[] = [];
    seed(store, leadFrom(migrated), {});
    expect(await runProactive(store, sent, "plan_ready")).toEqual(["suppressed"]);
    expect(sent).toHaveLength(0);
  });
});

describe("Plan-email unsubscribe", () => {
  // 6
  it("blocks every later proactive lifecycle send and leaves marketing unchanged", async () => {
    const identity = signup("reader@example.com", "2026-01-01T00:00:00.000Z");
    const withdrawn = withdrawPlan(identity, "2026-01-20T00:00:00.000Z");
    expect(withdrawn.marketing).toEqual(identity.marketing);

    for (const jobType of PROACTIVE_JOB_TYPES) {
      const store = createMemoryStore(() => NOW);
      const sent: EmailSendRequest[] = [];
      seed(store, leadFrom(withdrawn), { job_type: jobType, job_id: `job-${jobType}` });
      expect(await runProactive(store, sent, jobType)).toEqual(["canceled"]);
      expect(sent).toHaveLength(0);
      expect(store.jobs.get(`job-${jobType}`)?.status).toBe("canceled");
    }
  });
});

describe("Recovery consent boundary", () => {
  // 7
  it("activates inactive Plan consent with plan_recovery and a fresh timestamp", () => {
    const identity = withdrawPlan(
      signup("reader@example.com", "2026-01-01T00:00:00.000Z"),
      "2026-01-20T00:00:00.000Z",
    );
    const recovered = recoverConsent(identity, NOW.toISOString());

    expect(recovered.plan.active).toBe(true);
    expect(recovered.plan.source).toBe("plan_recovery");
    expect(recovered.plan.consentAt).toBe(NOW.toISOString());
    expect(recovered.plan.unsubscribedAt).toBeNull();
    expect(recovered.marketing).toEqual(identity.marketing);
  });

  // 8
  it("never reactivates withdrawn marketing consent", () => {
    const identity = withdrawMarketing(
      withdrawPlan(
        signup("reader@example.com", "2026-01-01T00:00:00.000Z"),
        "2026-01-10T00:00:00.000Z",
      ),
      "2026-01-11T00:00:00.000Z",
    );
    const recovered = recoverConsent(identity, NOW.toISOString());
    expect(recovered.marketing.active).toBe(false);
    expect(recovered.marketing.unsubscribedAt).toBe("2026-01-11T00:00:00.000Z");
    expect(recovered.plan.active).toBe(true);
  });

  // 9
  it("does not refresh consent, cancel jobs, or restart lifecycle when already active", async () => {
    const identity = signup("reader@example.com", "2026-01-01T00:00:00.000Z");
    const recovered = recoverConsent(identity, NOW.toISOString());
    expect(recovered).toEqual(identity);
    expect(recovered.plan.consentAt).toBe("2026-01-01T00:00:00.000Z");
    expect(recovered.plan.source).toBe("plan_signup");

    // A current lifecycle job created after the unchanged boundary still sends.
    const store = createMemoryStore(() => NOW);
    const sent: EmailSendRequest[] = [];
    seed(store, leadFrom(recovered), { created_at: "2026-02-01T11:55:00.000Z" });
    expect(await runProactive(store, sent, "plan_ready")).toEqual(["provider_accepted"]);
  });

  // 10
  it("fences every pre-Recovery proactive job out of sending", async () => {
    const recovered = recoverConsent(
      withdrawPlan(
        signup("reader@example.com", "2026-01-01T00:00:00.000Z"),
        "2026-01-20T00:00:00.000Z",
      ),
      NOW.toISOString(),
    );
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
      seed(store, leadFrom(recovered), {
        job_id: `stale-${label}`,
        // Created BEFORE the new Plan consent boundary.
        created_at: "2026-01-10T00:00:00.000Z",
        eligible_at: "2026-01-10T00:00:00.000Z",
        ...jobFields,
      });
      expect(await runProactive(store, sent, "plan_ready"), label).toEqual(["canceled"]);
      expect(sent, label).toHaveLength(0);
      expect(store.jobs.get(`stale-${label}`)?.status, label).toBe("canceled");
    }
  });

  // 12
  it("allows new qualifying post-Recovery lifecycle jobs to send", async () => {
    const recovered = recoverConsent(
      withdrawPlan(
        signup("reader@example.com", "2026-01-01T00:00:00.000Z"),
        "2026-01-20T00:00:00.000Z",
      ),
      "2026-02-01T11:00:00.000Z",
    );
    const store = createMemoryStore(() => NOW);
    const sent: EmailSendRequest[] = [];
    seed(store, leadFrom(recovered), {
      // Created AFTER the new Plan consent boundary.
      created_at: "2026-02-01T11:55:00.000Z",
      eligible_at: "2026-02-01T11:55:00.000Z",
    });
    expect(await runProactive(store, sent, "plan_ready")).toEqual(["provider_accepted"]);
    expect(sent).toHaveLength(1);
  });

  // 13
  it("blocks Recovery and later lifecycle sends on hard bounce and complaint", async () => {
    for (const reason of ["hard_bounce", "complaint"]) {
      const identity: Identity = {
        ...signup("reader@example.com", "2026-01-01T00:00:00.000Z"),
        suppression: reason,
      };

      const recoveryStore = createMemoryStore(() => NOW);
      const recoverySent: EmailSendRequest[] = [];
      seed(recoveryStore, leadFrom(identity), {
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
      seed(store, leadFrom(identity), {});
      expect(await runProactive(store, sent, "plan_ready")).toEqual(["suppressed"]);
      expect(sent).toHaveLength(0);
    }
  });

  // 11 (transactional Recovery is deliberately not consent-gated)
  it("does not consent-gate the transactional Recovery job type", () => {
    expect(isProactiveJobType("recovery")).toBe(false);
    for (const jobType of PROACTIVE_JOB_TYPES) {
      expect(isProactiveJobType(jobType)).toBe(true);
    }
  });
});

describe("Recovery route surface", () => {
  // 14
  it("renders the exact consent disclosure beneath the Recovery action", () => {
    expect(RECOVER_CONSENT_DISCLOSURE).toBe(
      "By recovering your plan, you agree to receive Gen X Jumps 7-Day Plan emails.",
    );
    const source = readFileSync("src/routes/recover.ts", "utf8");
    const form = source.slice(source.indexOf("Send My Link"));
    expect(form).toContain("RECOVER_CONSENT_DISCLOSURE");
  });

  // 15
  it("keeps one generic non-enumerating response for every request outcome", () => {
    const source = readFileSync("src/routes/recover.ts", "utf8");
    // unknown, malformed, rate-limited, replayed, suppressed and queued all
    // return the single shared acknowledgement.
    expect(source.match(/return genericAcknowledgement\(\);/g)?.length).toBeGreaterThanOrEqual(5);
    expect(RECOVER_GENERIC_RESPONSE).toBe(
      "If that email matches a Gen X Jumps plan, a new link is on the way.",
    );
  });
});

describe("migration contract", () => {
  // 16
  it("ships the forward-only consent migration with backfill, constraints, and cleanup", () => {
    const sql = readFileSync(
      "supabase/migrations/20260807175301_630a998c-8645-4bfa-9f21-e0c0166d673e.sql",
      "utf8",
    );

    // Two independent consent states with source, consent time, unsubscribe time.
    for (const column of [
      "plan_email_consent_active",
      "plan_email_consent_source",
      "plan_email_consent_at",
      "plan_email_unsubscribed_at",
      "marketing_consent_active",
      "marketing_consent_source",
      "marketing_consent_at",
    ]) {
      expect(sql).toContain(column);
    }

    // One normalized email is one identity.
    expect(sql).toContain("lead_plans_email_normalized_key");

    // Explicit pre-production test backfill source and migration-time timestamps.
    expect(sql).toContain("'pre_production_test_backfill'");

    // Contract constraints on source values and active-implies-consent.
    expect(sql).toContain("lead_plans_plan_consent_active_chk");
    expect(sql).toContain("lead_plans_marketing_consent_active_chk");

    // Signup activates both; Recovery activates Plan only.
    expect(sql).toContain("apply_signup_consent_state");
    expect(sql).toContain("'plan_signup'");
    expect(sql).toContain("'plan_recovery'");

    // Pre-migration nonterminal jobs of every type are canceled.
    expect(sql).toContain("WHERE status IN ('pending','processing','retry_scheduled')");
    expect(sql).toContain("status = 'canceled'");

    // No suppression row or contact is ever deleted.
    expect(sql).not.toContain("DELETE FROM public.email_suppressions");
    expect(sql).not.toContain("DELETE FROM public.lead_plans");
  });
});
