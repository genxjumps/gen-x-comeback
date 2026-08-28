import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const migration = source(
  "../../../../supabase/migrations/20260828180000_accelerator_enrollment_progress.sql",
).replace(/\s+/g, " ");
const functions = source("../functions.ts");
const access = source("../access.server.ts");
const privateRoute = source("../../../routes/accelerator.tsx");
const privateProgram = source("../../../components/accelerator-program.tsx");
const home = source("../../../routes/index.tsx");

describe("28-Day paid enrollment and progress foundation", () => {
  it("keeps the paid domain separate from the free lead plan lifecycle", () => {
    for (const table of [
      "paid_customers",
      "paid_purchases",
      "paid_product_entitlements",
      "paid_program_enrollments",
      "paid_program_access_sessions",
      "paid_program_day_completions",
      "paid_program_weekly_check_ins",
    ]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
    }
    const enrollmentTable = migration.slice(
      migration.indexOf("CREATE TABLE public.paid_program_enrollments"),
      migration.indexOf("CREATE TABLE public.paid_program_access_sessions"),
    );
    expect(enrollmentTable).not.toContain("lead_plans");
  });

  it("locks provisioning to the approved offer and exact version snapshot", () => {
    expect(migration).toContain("p_product_code <> 'accelerator_28'");
    expect(migration).toContain("p_amount_cents <> 3700");
    expect(migration).toContain("p_currency <> 'USD'");
    expect(migration).toContain("p_program_version <> 'accelerator_28_v1'");
    expect(migration).toContain("jsonb_array_length(p_program_snapshot->'days') <> 28");
    expect(migration).toContain("ARRAY(SELECT generate_series(1, 28)::smallint)");
    expect(migration).toContain("p_purchased_at + interval '7 days'");
    expect(migration).toContain(
      "CREATE TRIGGER protect_paid_program_enrollment_history_before_update",
    );
    expect(migration).toContain("paid program enrollment history is immutable");
  });

  it("makes enrollment provisioning idempotent and conflict-aware", () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0))");
    expect(migration).toContain("WHERE idempotency_key = p_idempotency_key FOR UPDATE");
    expect(migration).toContain("v_purchase.request_fingerprint <> p_request_fingerprint");
    expect(migration).toContain("'replayed'::text");
    expect(migration).toContain("'conflict'::text");
    expect(migration).toContain(
      "hashtextextended(p_purchase_source || chr(0) || p_source_reference, 1)",
    );
  });

  it("stores only hashed opaque credentials and resolves them server-side", () => {
    expect(migration).toContain("token_hash text NOT NULL UNIQUE");
    expect(migration).toContain("token_hash ~ '^[a-f0-9]{64}$'");
    expect(access).toContain("hashAccessToken(rawToken)");
    expect(access).toContain('.is("revoked_at", null)');
    expect(privateProgram).not.toContain("token_hash");
  });

  it("enforces exact-version sequential completion in one locked transaction", () => {
    const completion = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.complete_accelerator_day_atomic"),
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.save_accelerator_weekly_check_in_atomic",
      ),
    );
    expect(completion).toContain("n.program_version = p_program_version");
    expect(completion).toContain("FOR UPDATE OF n");
    expect(completion).toContain("generate_series(1, p_day_number - 1)");
    expect(completion).toContain("ON CONFLICT (enrollment_id, day_number) DO NOTHING");
    expect(completion).toContain("cardinality(v_completed) = 28");
  });

  it("saves one weekly check-in and unlocks it from completed work, not dates", () => {
    expect(migration).toContain(
      "CONSTRAINT paid_program_weekly_check_ins_unique UNIQUE (enrollment_id, week_number)",
    );
    expect(migration).toContain("v_completed_count < ((p_week_number - 1) * 7)");
    expect(migration).toContain("ON CONFLICT (enrollment_id, week_number) DO UPDATE");
    expect(migration).toContain(
      "IF NOT FOUND THEN RETURN QUERY SELECT * FROM public.paid_program_weekly_check_ins",
    );
    expect(migration).not.toContain("current_date");
  });

  it("keeps every table and write transaction service-role only", () => {
    expect(migration).toContain("REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated");
    for (const fn of [
      "provision_accelerator_enrollment",
      "complete_accelerator_day_atomic",
      "save_accelerator_weekly_check_in_atomic",
    ]) {
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
    expect(functions).toContain('createServerFn({ method: "POST" })');
  });

  it("keeps the database-backed route private and out of public navigation", () => {
    expect(privateRoute).toContain('name: "robots", content: "noindex, nofollow"');
    expect(home).not.toContain('to="/accelerator"');
    expect(privateProgram).toContain("Public enrollment is still");
    expect(privateProgram).toContain("Cloudflare Stream ID pending");
    expect(privateProgram).toContain("Weekly coaching video placeholder");
    expect(privateProgram).not.toMatch(/youtube\.com|youtu\.be|cloudflarestream\.com/);
  });

  it("contains no checkout, provider, marketing, or email activation path", () => {
    expect(privateProgram).not.toMatch(/stripe|checkout|mailer|resend/i);
    expect(functions).not.toMatch(/stripe|checkout|mailer|resend/i);
  });
});
