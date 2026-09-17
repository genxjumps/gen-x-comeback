import { resolveCustomerAccount } from "@/lib/account/customer-account.server";

export type AcceleratorAccess = {
  customerAccountId: string;
  entitlementId: string;
  enrollmentId: string;
  programVersion: string;
  firstName: string;
};

/**
 * Resolves Accelerator access from the verified customer account. Paid browser
 * tokens and a separate paid-customer identity are no longer authorization.
 */
export async function resolveAcceleratorAccess(
  authorizationHeader: string | null,
): Promise<AcceleratorAccess | null> {
  const accountResult = await resolveCustomerAccount(authorizationHeader);
  if (!accountResult.ok) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: entitlements, error: entitlementError } = await supabaseAdmin
    .from("paid_product_entitlements")
    .select("id")
    .eq("customer_id", accountResult.account.id)
    .eq("product_code", "accelerator_28")
    .eq("status", "active")
    .limit(1);
  if (entitlementError) throw new Error(entitlementError.message);
  const entitlement = entitlements?.[0];
  if (!entitlement) return null;

  const { data: runs, error: runError } = await supabaseAdmin
    .from("paid_program_enrollments")
    .select("id, program_version, status")
    .eq("customer_id", accountResult.account.id)
    .eq("entitlement_id", entitlement.id)
    .in("status", ["active", "paused", "completed"])
    .order("run_number", { ascending: false })
    .limit(100);
  if (runError) throw new Error(runError.message);
  const run =
    runs?.find(({ status }) => status === "active") ??
    runs?.find(({ status }) => status === "paused") ??
    runs?.[0];
  if (!run) return null;

  return {
    customerAccountId: accountResult.account.id,
    entitlementId: entitlement.id,
    enrollmentId: run.id,
    programVersion: run.program_version,
    firstName: accountResult.account.firstName ?? "Jumper",
  };
}
