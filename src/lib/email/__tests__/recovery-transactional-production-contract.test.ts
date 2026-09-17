import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260902183000_recovery_transactional_claim_contract.sql",
  ),
  "utf8",
);

describe("transactional recovery production contract", () => {
  it("lets recovery bypass Plan-email consent at claim time while keeping proactive jobs gated", () => {
    expect(MIGRATION).toContain("j.job_type = 'recovery'");
    expect(MIGRATION).toContain("l.plan_email_consent_active = true");
    expect(MIGRATION).toContain("l.plan_email_consent_at IS NOT NULL");
    expect(MIGRATION).toContain("j.created_at >= l.plan_email_consent_at");
    expect(MIGRATION).toMatch(
      /j\.job_type = 'recovery'[\s\S]*?OR \([\s\S]*?l\.plan_email_consent_active = true/,
    );
  });

  it("lets recovery bypass the final Plan-email consent fence before provider submission", () => {
    expect(MIGRATION).toContain("IF v_job.job_type <> 'recovery'");
    expect(MIGRATION).toContain("NOT COALESCE(v_lead.plan_email_consent_active, false)");
    expect(MIGRATION).toContain("v_job.created_at < v_lead.plan_email_consent_at");
  });

  it("keeps non-consent production safety gates on recovery", () => {
    for (const evidence of [
      "sending_enabled",
      "activation_boundary",
      "controlled_lead_plan_id",
      "email_suppressed_at",
      "hard_bounce",
      "complaint",
      "provider_submission_limit",
      "authenticated_at IS NOT NULL",
    ]) {
      expect(MIGRATION).toContain(evidence);
    }
  });

  it("does not couple recovery delivery to marketing consent", () => {
    expect(MIGRATION).not.toMatch(/marketing[_ ]email[_ ]consent/i);
  });
});
