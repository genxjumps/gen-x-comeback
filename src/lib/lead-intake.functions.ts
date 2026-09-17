import { createServerFn } from "@tanstack/react-start";
import { tokenOnlyInputSchema } from "@/lib/lead-schemas";
import type { SignupDestination } from "@/lib/signup-recovery.server";
export type LeadIntakeWelcomeResult = SignupDestination;
export const getLeadIntakeWelcome = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenOnlyInputSchema.parse(data))
  .handler(async ({ data }): Promise<LeadIntakeWelcomeResult> => {
    const { currentCookieHeader } = await import("@/lib/plan-access.server");
    const { resolveSignupDestination } = await import("@/lib/signup-recovery.server");
    return resolveSignupDestination(await currentCookieHeader(), data.token);
  });
