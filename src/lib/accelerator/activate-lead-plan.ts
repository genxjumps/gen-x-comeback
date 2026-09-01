import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ leadPlanId: z.string().uuid() });

export const activateLeadPlan = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { currentAuthorizationHeader, resolveCustomerAccount } =
      await import("@/lib/account/customer-account.server");
    const account = await resolveCustomerAccount(await currentAuthorizationHeader());
    if (!account.ok) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("activate_lead_plan_atomic", {
      p_customer_id: account.account.id,
      p_lead_plan_id: data.leadPlanId,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row || row.outcome !== "activated") return { ok: false as const };

    return {
      ok: true as const,
      leadPlanId: row.lead_plan_id as string,
      pausedAnotherProgram: Boolean(row.paused_enrollment_id),
    };
  });
