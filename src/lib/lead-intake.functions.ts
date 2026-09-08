import { createServerFn } from "@tanstack/react-start";

export type LeadIntakeWelcomeResult =
  | { ok: true; firstName: string }
  | { ok: false; reason: "missing_or_expired" };

export const getLeadIntakeWelcome = createServerFn({ method: "POST" })
  .inputValidator(() => ({}))
  .handler(async (): Promise<LeadIntakeWelcomeResult> => {
    const { currentCookieHeader } = await import("@/lib/plan-access.server");
    const { resolveLeadIntake } = await import("@/lib/lead-intake-handoff.server");
    const intake = await resolveLeadIntake(await currentCookieHeader());
    return intake
      ? { ok: true, firstName: intake.firstName }
      : { ok: false, reason: "missing_or_expired" };
  });
