import { hashAccessToken } from "@/lib/lead-plan";

export type AcceleratorAccess = {
  enrollmentId: string;
  programVersion: string;
  firstName: string;
};

/** Resolves a paid-program credential entirely on the server. */
export async function resolveAcceleratorAccess(
  rawToken: string,
): Promise<AcceleratorAccess | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = await hashAccessToken(rawToken);
  const nowIso = new Date().toISOString();

  const { data: sessions, error: sessionError } = await supabaseAdmin
    .from("paid_program_access_sessions")
    .select("enrollment_id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .limit(1);
  if (sessionError) throw new Error(sessionError.message);
  const session = sessions?.[0];
  if (!session) return null;

  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from("paid_program_enrollments")
    .select("id, customer_id, entitlement_id, program_version, status")
    .eq("id", session.enrollment_id)
    .in("status", ["active", "completed"])
    .limit(1);
  if (enrollmentError) throw new Error(enrollmentError.message);
  const enrollment = enrollments?.[0];
  if (!enrollment) return null;

  const [
    { data: entitlements, error: entitlementError },
    { data: customers, error: customerError },
  ] = await Promise.all([
    supabaseAdmin
      .from("paid_product_entitlements")
      .select("id")
      .eq("id", enrollment.entitlement_id)
      .eq("status", "active")
      .limit(1),
    supabaseAdmin
      .from("paid_customers")
      .select("first_name")
      .eq("id", enrollment.customer_id)
      .limit(1),
  ]);
  if (entitlementError) throw new Error(entitlementError.message);
  if (customerError) throw new Error(customerError.message);
  if (!entitlements?.[0] || !customers?.[0]) return null;

  const { error: seenError } = await supabaseAdmin
    .from("paid_program_access_sessions")
    .update({ last_seen_at: nowIso })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null);
  if (seenError) throw new Error(seenError.message);

  return {
    enrollmentId: enrollment.id,
    programVersion: enrollment.program_version,
    firstName: customers[0].first_name,
  };
}
