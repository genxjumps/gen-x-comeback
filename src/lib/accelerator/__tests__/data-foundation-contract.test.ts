import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const rawMigration = source(
  "../../../../supabase/migrations/20260828180000_accelerator_enrollment_progress.sql",
);
const rawOwnershipLockFix = source(
  "../../../../supabase/migrations/20260905170000_fix_accelerator_ownership_lock_separator.sql",
);
const ownershipLockFix = rawOwnershipLockFix
  .slice(rawOwnershipLockFix.indexOf("CREATE OR REPLACE FUNCTION"))
  .replace(/\s+/g, " ");
const migration = rawMigration.replace(/\s+/g, " ");
const functions = source("../functions.ts");
const access = source("../access.server.ts");
const provision = source("../provision.server.ts");
const privateRoute = source("../../../routes/accelerator.tsx");
const privateProgram = source("../../../components/accelerator-program.tsx");
const home = source("../../../routes/index.tsx");

describe("account-owned Accelerator and program-run foundation", () => {
  it("uses the unified customer account and removes the paid identity silo", () => {
    expect(migration).toContain(
      "customer_id uuid NOT NULL REFERENCES public.customer_accounts(id)",
    );
    expect(migration).not.toContain("CREATE TABLE public.paid_customers");
    expect(migration).not.toContain("CREATE TABLE public.paid_program_access_sessions");
    expect(access).toContain("resolveCustomerAccount(authorizationHeader)");
    expect(access).not.toContain("hashAccessToken");
  });

  it("records purchase and durable ownership without starting a run", () => {
    const ownership = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.provision_accelerator_ownership"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.start_program_run_atomic"),
    );
    expect(ownership).toContain("p_product_code <> 'accelerator_28'");
    expect(ownership).toContain("p_amount_cents <> 3700");
    expect(ownership).toContain("p_currency <> 'USD'");
    expect(ownership).toContain("p_purchased_at + interval '7 days'");
    expect(ownership).toContain("INSERT INTO public.paid_product_entitlements");
    expect(ownership).not.toContain("INSERT INTO public.paid_program_enrollments");
    expect(provision).not.toContain("buildAcceleratorProgramSnapshot");
  });

  it("makes verified purchase recording idempotent and conflict-aware", () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0))");
    expect(migration).toContain("WHERE idempotency_key = p_idempotency_key FOR UPDATE");
    expect(migration).toContain("v_purchase.request_fingerprint <> p_request_fingerprint");
    expect(migration).toContain("'replayed'::text");
    expect(migration).toContain("'conflict'::text");
  });

  it("uses a PostgreSQL-safe separator for the ownership advisory lock", () => {
    expect(ownershipLockFix).toContain(
      "hashtextextended(p_purchase_source || chr(31) || p_source_reference, 1)",
    );
    expect(ownershipLockFix).not.toContain("chr(0)");
    expect(ownershipLockFix).toContain(
      "ON CONFLICT ON CONSTRAINT paid_product_entitlements_customer_product_unique",
    );
    expect(ownershipLockFix).not.toContain("ON CONFLICT (customer_id, product_code)");
    expect(ownershipLockFix).toContain(
      "CREATE OR REPLACE FUNCTION public.provision_accelerator_ownership",
    );
    expect(ownershipLockFix).toContain(
      "GRANT EXECUTE ON FUNCTION public.provision_accelerator_ownership",
    );
  });

  it("preserves repeat runs and immutable version snapshots", () => {
    expect(migration).toContain(
      "CONSTRAINT paid_program_enrollments_run_unique UNIQUE (entitlement_id, run_number)",
    );
    expect(migration).not.toContain(
      "CONSTRAINT paid_program_enrollments_entitlement_unique UNIQUE (entitlement_id)",
    );
    expect(migration).toContain("SELECT COALESCE(max(run_number), 0) + 1");
    expect(migration).toContain("paid program run history is immutable");
    expect(migration).toContain(
      "NEW.program_snapshot, NEW.run_number, NEW.customer_time_zone, NEW.started_at",
    );
  });

  it("enforces one active structured run and safe switching", () => {
    expect(migration).toContain(
      "CREATE UNIQUE INDEX paid_program_enrollments_one_active_per_customer_idx",
    );
    expect(migration).toContain("WHERE status = 'active'");
    expect(migration).toContain("status IN ('active', 'paused', 'completed', 'revoked')");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.pause_program_run_atomic");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.resume_program_run_atomic");
    expect(migration).toContain("CREATE TABLE public.customer_active_programs");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.activate_lead_plan_atomic");
    expect(migration).toContain("SET status = 'paused', paused_at = now()");
  });

  it("keeps every table and lifecycle transaction service-role only", () => {
    expect(migration).toContain("REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated");
    for (const fn of [
      "provision_accelerator_ownership",
      "start_program_run_atomic",
      "pause_program_run_atomic",
      "resume_program_run_atomic",
      "activate_lead_plan_atomic",
      "accelerator_progress_state",
      "complete_accelerator_day_atomic",
      "undo_accelerator_day_atomic",
      "record_accelerator_video_view_atomic",
      "add_customer_measurement_atomic",
      "correct_customer_measurement_atomic",
      "remove_customer_measurement_atomic",
    ]) {
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
    expect(functions).toContain('createServerFn({ method: "POST" })');
  });

  it("keeps the proof route private and creates no commerce or email activation", () => {
    expect(privateRoute).toContain('name: "robots", content: "noindex, nofollow"');
    expect(home).not.toContain('to="/accelerator"');
    expect(privateProgram).toContain("Public enrollment is still");
    expect(rawMigration).not.toMatch(/stripe|mailer|resend/i);
    expect(provision).not.toMatch(/stripe|mailer|resend/i);
  });
});
