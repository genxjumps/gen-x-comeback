import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("customer program reminder preference contract", () => {
  it("keeps the preference account-owned, default-on, and service-role only", () => {
    const migration = readSource(
      "../../../../supabase/migrations/20260904110000_customer_program_reminder_preferences.sql",
    );

    expect(migration).toContain("CREATE TABLE public.customer_program_reminder_preferences");
    expect(migration).toContain("customer_id uuid PRIMARY KEY REFERENCES public.customer_accounts");
    expect(migration).toContain("program_reminders_enabled boolean NOT NULL DEFAULT true");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE");
    expect(migration).toContain("REVOKE DELETE");
    expect(migration).not.toMatch(/email|push notification/i);
  });

  it("uses the same preference for the inbox and the later comeback channel", () => {
    const functions = readSource("../functions.ts");
    const route = readSource("../../../routes/notifications.tsx");

    expect(functions).toContain("customer_program_reminder_preferences");
    expect(functions).toContain("return data?.[0]?.program_reminders_enabled ?? true");
    expect(functions).toContain(
      "const remindersEnabled = await programRemindersEnabled(account.account.id)",
    );
    expect(functions).toContain("programRemindersEnabled: remindersEnabled");
    expect(functions).toContain("buildComebackReminder");
    expect(functions).toContain("setProgramReminderPreference");
    expect(route).toContain("Program reminders");
    expect(route).toContain("Turning them off");
    expect(route).toContain("Turn Off");
    expect(route).toContain("Turn On");
  });
});
