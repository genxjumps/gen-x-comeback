import { z } from "zod";

import {
  ACCELERATOR_PROGRAM_VERSION,
  buildAcceleratorProgramSnapshot,
} from "@/lib/accelerator/program";

const idsSchema = z.object({
  customerAccountId: z.string().uuid(),
  entitlementId: z.string().uuid(),
});

const runSchema = z.object({
  customerAccountId: z.string().uuid(),
  enrollmentId: z.string().uuid(),
});

/**
 * Creates a run only when the customer explicitly starts an owned program.
 * The database pauses any other active structured run in the same transaction.
 */
export async function startAcceleratorRun(input: {
  customerAccountId: string;
  entitlementId: string;
}) {
  const parsed = idsSchema.parse(input);
  const snapshot = buildAcceleratorProgramSnapshot();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("start_program_run_atomic", {
    p_customer_id: parsed.customerAccountId,
    p_entitlement_id: parsed.entitlementId,
    p_program_version: ACCELERATOR_PROGRAM_VERSION,
    p_program_snapshot: snapshot,
  });
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row || row.outcome !== "started") {
    throw new Error("Accelerator program start was rejected");
  }
  return {
    enrollmentId: row.enrollment_id,
    runNumber: row.run_number,
    pausedEnrollmentId: row.paused_enrollment_id,
  };
}

export async function pauseProgramRun(input: { customerAccountId: string; enrollmentId: string }) {
  const parsed = runSchema.parse(input);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("pause_program_run_atomic", {
    p_customer_id: parsed.customerAccountId,
    p_enrollment_id: parsed.enrollmentId,
  });
  if (error) throw new Error(error.message);
  if (!rows?.[0]) throw new Error("Program pause was rejected");
  return { enrollmentId: rows[0].id, status: rows[0].status as "paused" };
}

export async function resumeProgramRun(input: { customerAccountId: string; enrollmentId: string }) {
  const parsed = runSchema.parse(input);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("resume_program_run_atomic", {
    p_customer_id: parsed.customerAccountId,
    p_enrollment_id: parsed.enrollmentId,
  });
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row || row.outcome !== "resumed") throw new Error("Program resume was rejected");
  return {
    enrollmentId: row.enrollment_id,
    pausedEnrollmentId: row.paused_enrollment_id,
  };
}
