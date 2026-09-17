import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("private customer progress access contract", () => {
  it("uses an account-bound allow-list before querying customer progress", () => {
    const functions = readSource("../functions.ts");

    expect(functions).toContain('from("private_customer_progress_admins")');
    expect(functions).toContain("resolveCustomerAccount");
    expect(functions.indexOf('from("private_customer_progress_admins")')).toBeLessThan(
      functions.indexOf('from("paid_product_entitlements")'),
    );
  });

  it("keeps the first view read-only and excludes payment, email, and refund behavior", () => {
    const route = readSource("../../../routes/admin.customers.tsx");

    expect(route).toContain("Read-only Accelerator progress");
    expect(route).toContain("does not change customer programs, payments, reminders, or access");
    expect(route).not.toMatch(/checkout|refund|email|insert\(|update\(|delete\(/i);
  });

  it("keeps the private route inside the authenticated platform boundary without adding navigation", () => {
    const root = readSource("../../../routes/__root.tsx");
    const shell = readSource("../../../components/platform-shell.tsx");

    expect(root).toContain('pathname === "/admin/customers"');
    expect(shell).not.toContain('to: "/admin/customers"');
  });
});
