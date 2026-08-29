import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const rawMigration = source(
  "../../../../supabase/migrations/20260828180000_accelerator_enrollment_progress.sql",
);
const migration = rawMigration.replace(/\s+/g, " ");
const functions = source("../functions.ts");
const summaries = source("../measurements.ts");

describe("independent customer measurement history", () => {
  it("replaces the forced combined weekly row with independent logical entries", () => {
    expect(migration).toContain("CREATE TABLE public.customer_measurements");
    expect(migration).not.toContain("CREATE TABLE public.paid_program_weekly_check_ins");
    expect(migration).toContain("measurement_kind IN ('weight', 'waist')");
    expect(migration).toContain(
      "measurement_context IN ('general', 'starting', 'progress', 'final')",
    );
    expect(migration).not.toContain("p_weight_value");
    expect(migration).not.toContain("p_waist_value");
  });

  it("binds every run measurement to the verified owning customer", () => {
    const add = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.add_customer_measurement_atomic"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.correct_customer_measurement_atomic"),
    );
    expect(add).toContain("run.customer_id = p_customer_id");
    expect(add).toContain("entitlement.status = 'active'");
    expect(add).toContain("p_measurement_context = 'general' AND p_enrollment_id IS NOT NULL");
  });

  it("supports one active starting and final value per run and kind", () => {
    expect(migration).toContain("customer_measurements_one_run_boundary_value_idx");
    expect(migration).toContain("(enrollment_id, measurement_kind, measurement_context)");
    expect(migration).toContain("measurement_context IN ('starting', 'final')");
    expect(migration).toContain("p_measurement_context = 'final'");
    expect(migration).toContain("run.status = 'completed'");
  });

  it("preserves append-only revisions for creation, correction, and removal", () => {
    expect(migration).toContain("CREATE TABLE public.customer_measurement_revisions");
    expect(migration).toContain("action IN ('created', 'corrected', 'removed')");
    expect(migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_measurement_revisions FROM service_role",
    );
    expect(migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_measurements FROM service_role",
    );
    for (const action of ["'created'", "'corrected'", "'removed'"]) {
      expect(migration).toContain(action);
    }
  });

  it("allows correction and independent removal only through account-bound transactions", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.correct_customer_measurement_atomic",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.remove_customer_measurement_atomic",
    );
    expect(migration).toContain("measurement.customer_id = p_customer_id");
    expect(migration).toContain("status = 'removed', removed_at = now(), revision = revision + 1");
    expect(functions).toContain("correct_customer_measurement_atomic");
    expect(functions).toContain("remove_customer_measurement_atomic");
  });

  it("binds new entries to the exact run loaded on screen", () => {
    expect(functions).toContain("access.enrollmentId !== data.enrollmentId");
    expect(functions).toContain("p_enrollment_id: data.enrollmentId");
  });

  it("does not reopen Day 28 after final results have been saved", () => {
    expect(migration).toContain("measurement.measurement_context = 'final'");
    expect(migration).toContain("measurement.status = 'active'");
  });

  it("loads active global history while keeping removed revisions in the backend", () => {
    expect(functions).toContain('.from("customer_measurements")');
    expect(functions).toContain('.eq("customer_id", access.customerAccountId)');
    expect(functions).toContain('.eq("status", "active")');
    expect(functions).not.toContain('.from("customer_measurement_revisions")');
    expect(functions).toContain("measurementSummary(measurements, access.enrollmentId)");
    expect(summaries).toContain("globalLatest");
    expect(summaries).toContain("runStarting");
    expect(summaries).toContain("runNewest");
    expect(summaries).toContain("runFinal");
  });
});
