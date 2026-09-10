import { createServerFn } from "@tanstack/react-start";

import type { CustomerAccountResult } from "@/lib/account/types";
import { z } from "zod";
import { RETURN_SESSION_COOKIE } from "@/lib/email/types";

export type AccountIdentityResult =
  | { ok: true; accountEmail: string | null; planEmail: string | null }
  | { ok: false };

/** Read identity without creating accounts or requiring an active paid entitlement. */
export const getAccountIdentity = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({ token: z.string().max(43).nullable() })
      .strict()
      .parse(data),
  )
  .handler(async ({ data }): Promise<AccountIdentityResult> => {
    try {
      const { currentAuthorizationHeader, resolveVerifiedCustomerIdentity } =
        await import("@/lib/account/customer-account.server");
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const { readCookie, resolvePlanAccess } = await import("@/lib/plan-access.server");
      const identity = await resolveVerifiedCustomerIdentity(await currentAuthorizationHeader());
      const cookie = getRequestHeader("cookie") ?? null;
      const plan =
        data.token || readCookie(cookie, RETURN_SESSION_COOKIE)
          ? await resolvePlanAccess(data.token, cookie)
          : null;
      let planEmail: string | null = null;
      if (plan) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: lead, error } = await supabaseAdmin
          .from("lead_plans")
          .select("email_normalized")
          .eq("id", plan.leadPlanId)
          .single();
        if (error) return { ok: false };
        planEmail = lead.email_normalized;
      }
      return { ok: true, accountEmail: identity?.emailNormalized ?? null, planEmail };
    } catch {
      return { ok: false };
    }
  });

/**
 * Private source-level account bootstrap. No public screen invokes this until
 * the later platform-shell checkpoint deliberately opens that path.
 */
export const getOrCreateCustomerAccount = createServerFn({ method: "POST" }).handler(
  async (): Promise<CustomerAccountResult> => {
    const { currentAuthorizationHeader, resolveCustomerAccount } =
      await import("@/lib/account/customer-account.server");
    return resolveCustomerAccount(await currentAuthorizationHeader());
  },
);
