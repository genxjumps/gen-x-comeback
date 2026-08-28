import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260828150000_mailerlite_marketing_sync.sql"),
  "utf8",
);
const ROUTE = readFileSync(
  join(process.cwd(), "src", "routes", "api", "public", "email", "dispatch.ts"),
  "utf8",
);
const ADAPTER = readFileSync(
  join(process.cwd(), "src", "lib", "marketing", "mailerlite.server.ts"),
  "utf8",
);

describe("durable marketing sync contract", () => {
  it("queues only future explicit marketing-consent activations with no migration backfill", () => {
    expect(MIGRATION).toContain("CREATE TABLE public.marketing_sync_jobs");
    expect(MIGRATION).toContain("NEW.marketing_consent_active");
    expect(MIGRATION).toContain("NEW.marketing_consent_at IS NULL");
    expect(MIGRATION).toContain("AFTER INSERT OR UPDATE OF marketing_consent_active");
    const enqueue = MIGRATION.slice(
      MIGRATION.indexOf("CREATE OR REPLACE FUNCTION public.enqueue_marketing_sync_job"),
      MIGRATION.indexOf("DROP TRIGGER IF EXISTS enqueue_marketing_sync_job_after_consent"),
    );
    expect(enqueue).toContain(") VALUES (");
    expect(enqueue).not.toContain("FROM public.lead_plans");
  });

  it("rechecks current consent and suppression under a final database lock", () => {
    expect(MIGRATION).toContain("CREATE OR REPLACE FUNCTION public.begin_marketing_sync_attempt");
    expect(MIGRATION).toContain("FOR UPDATE");
    expect(MIGRATION).toContain("marketing_consent_active");
    expect(MIGRATION).toContain("marketing_consent_at IS DISTINCT FROM v_job.consent_at");
    expect(MIGRATION).toContain("email_suppressed_at IS NOT NULL");
    expect(MIGRATION).toContain("s.reason IN ('hard_bounce', 'complaint')");
  });

  it("uses the authenticated scheduler but keeps MailerLite and Resend gates independent", () => {
    const auth = ROUTE.indexOf("authenticateProductionScheduler(request)");
    const marketing = ROUTE.indexOf("runProductionMarketingSync()");
    const emailGate = ROUTE.indexOf("readProductionDispatchGate()");
    expect(auth).toBeGreaterThan(-1);
    expect(marketing).toBeGreaterThan(auth);
    expect(emailGate).toBeGreaterThan(marketing);
    expect(ROUTE).toContain('marketingSync = { enabled: true, error: "dispatch_failed" }');
  });

  it("never sends assessment or forced-reactivation fields to MailerLite", () => {
    const payloadStart = ADAPTER.indexOf("body: JSON.stringify({");
    const payloadEnd = ADAPTER.indexOf("}),", payloadStart);
    const payload = ADAPTER.slice(payloadStart, payloadEnd);
    for (const forbidden of [
      "assessment",
      "weight",
      "protein",
      "plan",
      "progress",
      "resubscribe",
      "status",
    ])
      expect(payload.toLowerCase()).not.toContain(forbidden);
  });
});
