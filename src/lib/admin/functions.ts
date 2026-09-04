import { createServerFn } from "@tanstack/react-start";
import {
  buildAdminCustomerProgress,
  sortAdminCustomerProgress,
  type AdminCompletion,
  type AdminEnrollment,
} from "@/lib/admin/customer-progress";
import { privateCustomerProgressInputSchema } from "@/lib/admin/schemas";
import type { PrivateCustomerProgressResult } from "@/lib/admin/types";
import { toCustomerMeasurement } from "@/lib/accelerator/measurement-row";

async function loadPrivateCustomerProgressAccess() {
  const { currentAuthorizationHeader, resolveCustomerAccount } =
    await import("@/lib/account/customer-account.server");
  const account = await resolveCustomerAccount(await currentAuthorizationHeader());
  if (!account.ok) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("private_customer_progress_admins")
    .select("customer_id")
    .eq("customer_id", account.account.id)
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.length ? account.account : null;
}

export const getPrivateCustomerProgress = createServerFn({ method: "POST" })
  .validator((data: unknown) => privateCustomerProgressInputSchema.parse(data))
  .handler(async (): Promise<PrivateCustomerProgressResult> => {
    const access = await loadPrivateCustomerProgressAccess();
    if (!access) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entitlementResult = await supabaseAdmin
      .from("paid_product_entitlements")
      .select("customer_id, granted_at")
      .eq("product_code", "accelerator_28")
      .eq("status", "active");
    if (entitlementResult.error) throw new Error(entitlementResult.error.message);
    const entitlements = entitlementResult.data ?? [];
    const customerIds = entitlements.map((entitlement) => entitlement.customer_id);
    if (!customerIds.length) {
      return { ok: true, customers: [], generatedAt: new Date().toISOString() };
    }

    const [accountResult, enrollmentResult, measurementResult] = await Promise.all([
      supabaseAdmin.from("customer_accounts").select("id, first_name").in("id", customerIds),
      supabaseAdmin
        .from("paid_program_enrollments")
        .select("id, customer_id, run_number, status, started_at, paused_at, completed_at")
        .eq("product_code", "accelerator_28")
        .in("customer_id", customerIds)
        .neq("status", "revoked"),
      supabaseAdmin
        .from("customer_measurements")
        .select(
          "id, customer_id, enrollment_id, measurement_kind, value, unit, measurement_context, notes, measured_at, created_at",
        )
        .in("customer_id", customerIds)
        .eq("status", "active"),
    ]);
    for (const result of [accountResult, enrollmentResult, measurementResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const enrollments = enrollmentResult.data ?? [];
    const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
    const completionResult = enrollmentIds.length
      ? await supabaseAdmin
          .from("paid_program_day_completions")
          .select("enrollment_id, day_number, completed_at")
          .in("enrollment_id", enrollmentIds)
      : { data: [], error: null };
    if (completionResult.error) throw new Error(completionResult.error.message);

    const accounts = new Map((accountResult.data ?? []).map((account) => [account.id, account]));
    const now = new Date();
    const customers = entitlements.flatMap((entitlement) => {
      const account = accounts.get(entitlement.customer_id);
      if (!account) return [];
      const customerEnrollments: AdminEnrollment[] = enrollments
        .filter((enrollment) => enrollment.customer_id === entitlement.customer_id)
        .map((enrollment) => ({
          id: enrollment.id,
          runNumber: enrollment.run_number,
          status: enrollment.status as AdminEnrollment["status"],
          startedAt: enrollment.started_at,
          pausedAt: enrollment.paused_at,
          completedAt: enrollment.completed_at,
        }));
      const customerCompletions: AdminCompletion[] = (completionResult.data ?? [])
        .filter((completion) =>
          customerEnrollments.some((run) => run.id === completion.enrollment_id),
        )
        .map((completion) => ({
          enrollmentId: completion.enrollment_id,
          dayNumber: completion.day_number,
          completedAt: completion.completed_at,
        }));
      const customerMeasurements = (measurementResult.data ?? [])
        .filter((measurement) => measurement.customer_id === entitlement.customer_id)
        .map(toCustomerMeasurement);
      return [
        buildAdminCustomerProgress({
          customerId: entitlement.customer_id,
          firstName: account.first_name,
          enrolledAt: entitlement.granted_at,
          enrollments: customerEnrollments,
          completions: customerCompletions,
          measurements: customerMeasurements,
          now,
        }),
      ];
    });

    return {
      ok: true,
      customers: sortAdminCustomerProgress(customers),
      generatedAt: now.toISOString(),
    };
  });
