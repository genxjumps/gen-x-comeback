import { resolveCustomerAccount } from "@/lib/account/customer-account.server";

export const NUTRITION_ELIGIBLE_PRODUCT_CODES = ["accelerator_28"] as const;

export type NutritionAccess = {
  customerAccountId: string;
  firstName: string;
  eligible: boolean;
};

/**
 * Resolves account-level nutrition access. Ownership is sufficient - an
 * Accelerator run does not have to be started or active.
 */
export async function resolveNutritionAccess(
  authorizationHeader: string | null,
): Promise<NutritionAccess | null> {
  const accountResult = await resolveCustomerAccount(authorizationHeader);
  if (!accountResult.ok) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("paid_product_entitlements")
    .select("id")
    .eq("customer_id", accountResult.account.id)
    .eq("status", "active")
    .in("product_code", [...NUTRITION_ELIGIBLE_PRODUCT_CODES])
    .limit(1);
  if (error) throw new Error(error.message);

  return {
    customerAccountId: accountResult.account.id,
    firstName: accountResult.account.firstName ?? "Jumper",
    eligible: Boolean(data?.length),
  };
}
