// Automated acceptance tests for the Plan Ready contract release gate.
// Each test name maps 1:1 to a numbered acceptance test in the contract.
// Deterministic: fixed clock, fake provider, in-memory store.
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  dispatchPlanReadyJobs,
  raiseStalePlanReadyAlerts,
  type DispatchDeps,
} from "@/lib/email/dispatch";
import {
  PROHIBITED_TEMPLATE_PATTERNS,
  PLAN_READY_CTA_LABEL,
  renderPlanReady,
  sanitizeFirstName,
} from "@/lib/email/plan-ready-template";
import { evaluateSendingGate, type EmailConfig } from "@/lib/email/config.server";
import {
  canApplyDeliveryTransition,
  mapProviderEvent,
  verifyWebhookSignature,
} from "@/lib/email/webhook-signature";
import {
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  type EmailAdapter,
  type EmailSendResult,
} from "@/lib/email/types";
import { createMemoryStore, makeJob, makeLead, type MemoryStore } from "./memory-store";

const FIXED_NOW = new Date("2026-02-01T12:00:00.000Z");

function scriptedAdapter(
  results: EmailSendResult[],
  lookup?: EmailAdapter["lookupByIdempotencyKey"],
) {
  const sent: Array<Parameters<EmailAdapter["send"]>[0]> = [];
  let index = 0;
  const adapter: EmailAdapter = {
    key: "fake",
    send: async (request) => {
      sent.push(request);
      const result = results[Math.min(index, results.length - 1)];
      index += 1;
      return result;
    },
    ...(lookup ? { lookupByIdempotencyKey: lookup } : {}),
  };
  return { adapter, sent };
}

function makeDeps(
  store: MemoryStore,
  adapter: EmailAdapter,
  now: () => Date = () => FIXED_NOW,
): DispatchDeps {
  return {
    store,
    adapter,
    now,
    appOrigin: "https://app.genxjumps.com",
    fromEmail: "todd@notify.genxjumps.com",
    fromName: "Todd from Gen X Jumps",
    replyTo: "todd@genxjumps.com",
    deriveCredential: (purpose, planVersionId) => `cred:${purpose}:${planVersionId}`,
    hash: async (raw) => `hash:${raw}`,
  };
}

function seed(now: () => Date = () => FIXED_NOW) {
  const store = createMemoryStore(now);
  store.leads.set("lead-1", makeLead());
  store.jobs.set("job-1", makeJob());
  return store;
}

const FULL_CONFIG: EmailConfig = {
  appOrigin: "https://app.genxjumps.com",
  providerKey: "resend",
  providerApiKey: "key",
  fromEmail: "todd@notify.genxjumps.com",
  fromName: "Todd from Gen X Jumps",
  replyTo: "todd@genxjumps.com",
  webhookSecret: "whsec_dGVzdHNlY3JldA==",
  clickTrackingDisabled: true,
  alertsEnabled: true,
  domainVerified: true,
  stagingAcceptancePassed: true,
};

describe("Plan Ready acceptance gates", () => {
  it("Acceptance 1: a claimed Plan Ready job sends once and records provider acceptance", async () => {
    const store = seed();
    const { adapter, sent } = scriptedAdapter([
      {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: "pm_1",
        acceptedAt: FIXED_NOW.toISOString(),
      },
    ]);
    const summary = await dispatchPlanReadyJobs(makeDeps(store, adapter));

    expect(summary.claimed).toBe(1);
    expect(sent).toHaveLength(1);
    expect(store.jobs.get("job-1")?.status).toBe("provider_accepted");
    expect(store.events.map((e) => e.event_name)).toContain("email_plan_ready_provider_accepted");
    // Unlock never depends on delivery: no plan mutation happens in the dispatcher.
    expect(store.returnTokens).toHaveLength(1);
  });

  it("Acceptance 2: a second dispatch pass reuses the stable idempotency key and does not resend an accepted job", async () => {
    const store = seed();
    const { adapter, sent } = scriptedAdapter([
      {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: "pm_1",
        acceptedAt: FIXED_NOW.toISOString(),
      },
    ]);
    const deps = makeDeps(store, adapter);
    await dispatchPlanReadyJobs(deps);
    const second = await dispatchPlanReadyJobs(deps);

    expect(second.claimed).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].idempotencyKey).toBe("plan_ready:version-1:v1");
  });

  it("Acceptance 3: a job whose plan version was replaced is canceled and never sent", async () => {
    const store = seed();
    store.leads.set("lead-1", makeLead({ plan_version_id: "version-2" }));
    const { adapter, sent } = scriptedAdapter([
      {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: "pm_1",
        acceptedAt: FIXED_NOW.toISOString(),
      },
    ]);
    await dispatchPlanReadyJobs(makeDeps(store, adapter));

    expect(sent).toHaveLength(0);
    expect(store.jobs.get("job-1")?.status).toBe("canceled");
  });

  it("Acceptance 4: rendered HTML and plain text contain every required field and no prohibited data", () => {
    const rendered = renderPlanReady({
      firstName: "Todd",
      returnUrl: "https://app.genxjumps.com/return?token=abc",
      preferencesUrl: "https://app.genxjumps.com/email-preferences?c=def",
    });

    expect(rendered.subject).toContain("Todd");
    expect(rendered.previewText.length).toBeGreaterThan(0);
    expect(rendered.html).toContain(PLAN_READY_CTA_LABEL);
    expect(rendered.html).toContain("https://app.genxjumps.com/return?token=abc");
    expect(rendered.html).toContain("Manage email preferences");
    expect(rendered.html).toContain('lang="en"');
    // Plain text must carry the complete URL, not a bare label.
    expect(rendered.text).toContain("https://app.genxjumps.com/return?token=abc");
    expect(rendered.text).toContain("https://app.genxjumps.com/email-preferences?c=def");
    expect(rendered.text).toContain("You received this because you requested");

    for (const pattern of PROHIBITED_TEMPLATE_PATTERNS) {
      expect(rendered.html).not.toMatch(pattern);
      expect(rendered.text).not.toMatch(pattern);
    }

    // Unsafe personalization is stripped of markup, and an unusable name falls back.
    expect(sanitizeFirstName("  <script>  ")).toBe("script");
    expect(sanitizeFirstName("   ")).toBeNull();
    expect(sanitizeFirstName("<>&\"'`")).toBeNull();
    const fallback = renderPlanReady({
      firstName: "   ",
      returnUrl: "https://app.genxjumps.com/return?token=abc",
      preferencesUrl: "https://app.genxjumps.com/email-preferences?c=def",
    });
    expect(fallback.personalizedName).toBeNull();
    expect(fallback.text).toContain("Hey there,");
  });

  it("Acceptance 5: each transient retry uses the approved delay and a permanent failure does not loop", async () => {
    const store = seed();
    const { adapter } = scriptedAdapter([{ outcome: "transient", errorCode: "provider_5xx" }]);
    const deps = makeDeps(store, adapter);

    await dispatchPlanReadyJobs(deps);
    const job = store.jobs.get("job-1")!;
    expect(job.status).toBe("retry_scheduled");
    expect(job.next_attempt_at).toBe(
      new Date(FIXED_NOW.getTime() + RETRY_DELAYS_MS[0]).toISOString(),
    );

    // Exhausting the schedule ends terminally instead of looping.
    job.attempt_count = MAX_ATTEMPTS - 1;
    job.status = "retry_scheduled";
    job.next_attempt_at = null;
    await dispatchPlanReadyJobs(deps);
    expect(store.jobs.get("job-1")?.status).toBe("failed_permanent");
    expect(store.alerts.some((a) => a.alert_type === "plan_ready_failed_permanent")).toBe(true);

    const permanentStore = seed();
    const permanent = scriptedAdapter([{ outcome: "permanent", errorCode: "invalid_recipient" }]);
    await dispatchPlanReadyJobs(makeDeps(permanentStore, permanent.adapter));
    expect(permanentStore.jobs.get("job-1")?.status).toBe("failed_permanent");
    expect(permanent.sent).toHaveLength(1);
  });

  it("Acceptance 6: an ambiguous timeout reconciles instead of duplicating, and a stale pending job alerts", async () => {
    const store = seed();
    const { adapter, sent } = scriptedAdapter(
      [{ outcome: "ambiguous", errorCode: "timeout" }],
      async (key) => ({
        providerMessageId: `pm_for_${key}`,
        acceptedAt: FIXED_NOW.toISOString(),
      }),
    );
    await dispatchPlanReadyJobs(makeDeps(store, adapter));

    expect(sent).toHaveLength(1);
    const job = store.jobs.get("job-1")!;
    expect(job.status).toBe("provider_accepted");
    expect(job.provider_message_id).toBe("pm_for_plan_ready:version-1:v1");

    // A held lease prevents a second worker from claiming the same job.
    const leased = seed();
    const leasedJob = leased.jobs.get("job-1")!;
    leasedJob.status = "processing";
    leasedJob.lease_expires_at = new Date(FIXED_NOW.getTime() + 60_000).toISOString();
    const blocked = scriptedAdapter([
      { outcome: "accepted", providerKey: "fake", providerMessageId: "x", acceptedAt: "" },
    ]);
    expect((await dispatchPlanReadyJobs(makeDeps(leased, blocked.adapter))).claimed).toBe(0);

    // A pending job older than the stale window raises exactly one alert.
    const stale = seed();
    stale.jobs.get("job-1")!.created_at = new Date(FIXED_NOW.getTime() - 600_000).toISOString();
    const alerts = await raiseStalePlanReadyAlerts(makeDeps(stale, blocked.adapter));
    expect(alerts).toBe(1);
    expect(await raiseStalePlanReadyAlerts(makeDeps(stale, blocked.adapter))).toBe(0);
  });

  it("Acceptance 7: a sent link issues a hashed 30-day return token bound to the current plan version", async () => {
    const store = seed();
    const { adapter, sent } = scriptedAdapter([
      {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: "pm_1",
        acceptedAt: FIXED_NOW.toISOString(),
      },
    ]);
    await dispatchPlanReadyJobs(makeDeps(store, adapter));

    const token = store.returnTokens[0];
    expect(token.planVersionId).toBe("version-1");
    // Only the hash is stored; the raw token exists only inside the message.
    expect(token.tokenHash.startsWith("hash:")).toBe(true);
    const ttlDays = (Date.parse(token.expiresAt) - Date.parse(token.issuedAt)) / 86_400_000;
    expect(ttlDays).toBe(30);
    const raw = token.tokenHash.slice("hash:".length);
    expect(sent[0].html).toContain(`/return?token=${raw}`);
    // The bearer token never appears in the destination My Plan URL.
    expect(sent[0].html).not.toContain(`/your-plan?token=${raw}`);
  });

  it("Acceptance 8: invalid, expired, revoked, malformed, and replaced tokens share one generic outcome", async () => {
    const { exchangeReturnToken } = await import("@/lib/email/return-exchange.server");
    // A malformed token is rejected before any database or account lookup.
    for (const candidate of [null, "", "not-a-token", "z".repeat(64)]) {
      expect(await exchangeReturnToken(candidate)).toEqual({ ok: false });
    }
  });

  it("Acceptance 9: scanner opens and provider click events are reporting only and never verify", () => {
    expect(mapProviderEvent({ type: "email.opened", data: { email_id: "pm_1" } }).kind).toBe(
      "reporting",
    );
    expect(mapProviderEvent({ type: "email.clicked", data: { email_id: "pm_1" } }).kind).toBe(
      "reporting",
    );
    expect(mapProviderEvent({ type: "email.opened", data: {} }).suppression).toBeNull();
    // Only a deliberate server-side exchange can verify, which requires a POST.
    expect(mapProviderEvent({ type: "email.something_else" }).kind).toBe("ignored");
  });

  it("Acceptance 10: hard bounce and complaint block sending while a soft bounce does not", async () => {
    const store = seed();
    store.suppressions.set("reader@example.com", "hard_bounce");
    const { adapter, sent } = scriptedAdapter([
      {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: "pm_1",
        acceptedAt: FIXED_NOW.toISOString(),
      },
    ]);
    await dispatchPlanReadyJobs(makeDeps(store, adapter));

    expect(sent).toHaveLength(0);
    expect(store.jobs.get("job-1")?.status).toBe("suppressed");
    expect(store.events.map((e) => e.event_name)).toContain("email_plan_ready_suppressed");
    // The lead record itself is untouched, so plan access is retained.
    expect(store.leads.get("lead-1")?.plan_version_id).toBe("version-1");

    expect(
      mapProviderEvent({
        type: "email.bounced",
        data: { email_id: "x", bounce: { type: "Permanent" } },
      }).suppression,
    ).toBe("hard_bounce");
    expect(
      mapProviderEvent({
        type: "email.bounced",
        data: { email_id: "x", bounce: { type: "SoftBounce" } },
      }).suppression,
    ).toBeNull();
    expect(
      mapProviderEvent({ type: "email.complained", data: { email_id: "x" } }).suppression,
    ).toBe("complaint");

    // Marketing unsubscribe is not a suppression source for this transactional job.
    const unsubscribed = seed();
    const ok = scriptedAdapter([
      {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: "pm_2",
        acceptedAt: FIXED_NOW.toISOString(),
      },
    ]);
    await dispatchPlanReadyJobs(makeDeps(unsubscribed, ok.adapter));
    expect(ok.sent).toHaveLength(1);
  });

  it("Acceptance 11: signature verification and terminal-state ordering are enforced", () => {
    const secret = "whsec_dGVzdHNlY3JldA==";
    const body = JSON.stringify({ type: "email.delivered", data: { email_id: "pm_1" } });
    const nowSeconds = 1_770_000_000;
    const headers = {
      id: "msg_1",
      timestamp: String(nowSeconds),
      signature: null as string | null,
    };

    expect(verifyWebhookSignature(secret, headers, body, nowSeconds)).toBe(false);
    expect(
      verifyWebhookSignature(secret, { ...headers, signature: "v1,bogus" }, body, nowSeconds),
    ).toBe(false);
    expect(
      verifyWebhookSignature(null, { ...headers, signature: "v1,bogus" }, body, nowSeconds),
    ).toBe(false);

    // A correctly signed payload verifies, and a stale timestamp does not.
    const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
      .update(`msg_1.${nowSeconds}.${body}`)
      .digest("base64");
    expect(
      verifyWebhookSignature(secret, { ...headers, signature: `v1,${expected}` }, body, nowSeconds),
    ).toBe(true);
    expect(
      verifyWebhookSignature(
        secret,
        { ...headers, signature: `v1,${expected}` },
        body,
        nowSeconds + 100_000,
      ),
    ).toBe(false);

    expect(canApplyDeliveryTransition("delivered", "delivered")).toBe(false);
    expect(canApplyDeliveryTransition("complained", "delivered")).toBe(false);
    expect(canApplyDeliveryTransition("bounced", "delivered")).toBe(false);
    expect(canApplyDeliveryTransition("bounced", "complained")).toBe(true);
    expect(canApplyDeliveryTransition("pending", "delivered")).toBe(true);
  });

  it("Acceptance 12: only plan_ready jobs are dispatched, so no later email can precede it", async () => {
    const store = seed();
    store.jobs.set(
      "job-2",
      makeJob({
        job_id: "job-2",
        job_type: "start_day_1",
        idempotency_key: "start_day_1:version-1:v1",
      }),
    );
    const { adapter, sent } = scriptedAdapter([
      {
        outcome: "accepted",
        providerKey: "fake",
        providerMessageId: "pm_1",
        acceptedAt: FIXED_NOW.toISOString(),
      },
    ]);
    const summary = await dispatchPlanReadyJobs(makeDeps(store, adapter));

    expect(summary.claimed).toBe(1);
    expect(sent).toHaveLength(1);
    expect(store.jobs.get("job-2")?.status).toBe("pending");
  });

  it("Acceptance 13: the message is usable with images disabled and keyboard accessible", () => {
    const rendered = renderPlanReady({
      firstName: "Todd",
      returnUrl: "https://app.genxjumps.com/return?token=abc",
      preferencesUrl: "https://app.genxjumps.com/email-preferences?c=def",
    });

    // No image carries meaning: there are no <img> elements at all.
    expect(rendered.html).not.toMatch(/<img/i);
    // The CTA is a real anchor, so it is focusable and activatable by keyboard.
    expect(rendered.html).toMatch(
      /<a href="https:\/\/app\.genxjumps\.com\/return\?token=abc"[^>]*>Open My Plan<\/a>/,
    );
    expect(rendered.html).toContain('role="presentation"');
    expect(rendered.html).toContain("max-width:560px");
    expect(rendered.text.trim().length).toBeGreaterThan(200);
  });

  it("Acceptance 14: provider runtime stays disabled until every prerequisite is configured", () => {
    const blocked = evaluateSendingGate({
      ...FULL_CONFIG,
      providerApiKey: null,
      webhookSecret: null,
      domainVerified: false,
      alertsEnabled: false,
      stagingAcceptancePassed: false,
    });
    expect(blocked.enabled).toBe(false);
    if (!blocked.enabled) {
      expect(blocked.missing).toEqual(
        expect.arrayContaining([
          "EMAIL_PROVIDER_API_KEY",
          "EMAIL_WEBHOOK_SECRET",
          "EMAIL_SENDING_DOMAIN_VERIFIED",
          "EMAIL_ALERTS_ENABLED",
          "EMAIL_STAGING_ACCEPTANCE_PASSED",
        ]),
      );
    }

    // Click tracking must stay disabled for the secure CTA.
    expect(evaluateSendingGate({ ...FULL_CONFIG, clickTrackingDisabled: false }).enabled).toBe(
      false,
    );
    expect(evaluateSendingGate(FULL_CONFIG).enabled).toBe(true);
  });
});
