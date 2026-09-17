import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const migration = source(
  "../../../../supabase/migrations/20260828170000_customer_account_foundation.sql",
).replace(/\s+/g, " ");
const accountServer = source("../customer-account.server.ts");
const accountFunctions = source("../functions.ts");
const home = source("../../../routes/index.tsx");

describe("unified customer account source contract", () => {
  it("creates one account per auth user and verified email", () => {
    expect(migration).toContain("CREATE TABLE public.customer_accounts");
    expect(migration).toContain("auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id)");
    expect(migration).toContain("email_normalized text NOT NULL UNIQUE");
    expect(migration).toContain("email_verified_at timestamptz NOT NULL");
  });

  it("links matching free-plan records without changing their lifecycle or consent", () => {
    expect(migration).toContain("CREATE TABLE public.customer_lead_plan_links");
    expect(migration).toContain("link_source = 'verified_email'");
    expect(migration).toContain("FROM public.lead_plans lead");
    expect(migration).toContain("lead.email_normalized = p_email_normalized");
    expect(migration).not.toContain("SET marketing_consent_active");
    expect(migration).not.toContain("SET plan_email_consent_active");
  });

  it("keeps identity resolution service-role only and browser writes closed", () => {
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.customer_accounts FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.resolve_verified_customer_account");
    expect(migration).toContain("TO service_role");
    expect(accountServer).toContain("supabaseAdmin.auth.getUser(token)");
    expect(accountServer).toContain("user.email_confirmed_at");
  });

  it("adds no public account route, provider send, or enrollment activation", () => {
    expect(home).not.toContain("getOrCreateCustomerAccount");
    expect(accountFunctions).not.toMatch(/resend|mailer|checkout|stripe/i);
    expect(accountServer).not.toMatch(/resend|mailer|checkout|stripe/i);
  });

  it("does not apply or weaken the gated Accelerator migration", () => {
    expect(migration).toContain("still-unapplied Accelerator");
    expect(migration).not.toContain("provision_accelerator_enrollment");
    expect(migration).not.toContain("paid_program_enrollments");
  });
});
