import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const rawMigration = source(
  "../../../../supabase/migrations/20260904100000_program_week_measurement_reminders.sql",
);
const migration = rawMigration.replace(/\s+/g, " ");
const functions = source("../functions.ts");

describe("weekly measurement reminder persistence contract", () => {
  it("persists one dismissal per run and program week", () => {
    expect(migration).toContain("CREATE TABLE public.customer_program_reminder_dismissals");
    expect(migration).toContain("CHECK (program_week BETWEEN 2 AND 4)");
    expect(migration).toContain("UNIQUE (enrollment_id, reminder_code, program_week)");
    expect(migration).toContain("FOREIGN KEY (enrollment_id, customer_id)");
    expect(migration).toContain("ON DELETE CASCADE");
  });

  it("keeps reminder state service-role only and append-only", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT SELECT, INSERT");
    expect(migration).toContain("REVOKE UPDATE, DELETE");
  });

  it("authorizes through the customer account and active Accelerator run", () => {
    expect(functions).toContain("resolveCustomerAccount");
    expect(functions).toContain('.eq("customer_id", account.account.id)');
    expect(functions).toContain('.eq("product_code", "accelerator_28")');
    expect(functions).toContain('enrollment.status !== "active"');
    expect(functions).toContain("state.reminder.enrollmentId !== data.enrollmentId");
    expect(functions).not.toMatch(/send|email|push/i);
  });
});
