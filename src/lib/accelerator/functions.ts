import { createServerFn } from "@tanstack/react-start";

import type { AcceleratorProgramSnapshot, AcceleratorWeek } from "@/lib/accelerator/program";
import {
  acceleratorCheckInInputSchema,
  acceleratorProgramSnapshotSchema,
  acceleratorAccountInputSchema,
  completeAcceleratorDayInputSchema,
} from "@/lib/accelerator/schemas";
import type {
  AcceleratorCheckIn,
  AcceleratorHubResult,
  AcceleratorProgressResult,
  SaveAcceleratorCheckInResult,
} from "@/lib/accelerator/types";

async function authorize() {
  const { currentAuthorizationHeader } = await import("@/lib/account/customer-account.server");
  const { resolveAcceleratorAccess } = await import("@/lib/accelerator/access.server");
  return resolveAcceleratorAccess(await currentAuthorizationHeader());
}

function toCheckIn(row: {
  week_number: number;
  weight_value: number;
  weight_unit: string;
  waist_value: number;
  waist_unit: string;
  notes: string | null;
  recorded_at: string;
}): AcceleratorCheckIn {
  return {
    week: row.week_number as AcceleratorWeek,
    weight: { value: Number(row.weight_value), unit: row.weight_unit as "lb" | "kg" },
    waist: { value: Number(row.waist_value), unit: row.waist_unit as "in" | "cm" },
    notes: row.notes,
    recordedAt: row.recorded_at,
  };
}

export const getAcceleratorHub = createServerFn({ method: "POST" })
  .validator((data: unknown) => acceleratorAccountInputSchema.parse(data))
  .handler(async ({ data }): Promise<AcceleratorHubResult> => {
    const access = await authorize();
    if (!access) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [enrollmentResult, completionResult, checkInResult] = await Promise.all([
      supabaseAdmin
        .from("paid_program_enrollments")
        .select("program_snapshot, program_version")
        .eq("id", access.enrollmentId)
        .eq("program_version", access.programVersion)
        .limit(1),
      supabaseAdmin
        .from("paid_program_day_completions")
        .select("day_number")
        .eq("enrollment_id", access.enrollmentId)
        .eq("program_version", access.programVersion)
        .order("day_number", { ascending: true }),
      supabaseAdmin
        .from("paid_program_weekly_check_ins")
        .select(
          "week_number, weight_value, weight_unit, waist_value, waist_unit, notes, recorded_at",
        )
        .eq("enrollment_id", access.enrollmentId)
        .eq("program_version", access.programVersion)
        .order("week_number", { ascending: true }),
    ]);

    if (enrollmentResult.error) throw new Error(enrollmentResult.error.message);
    if (completionResult.error) throw new Error(completionResult.error.message);
    if (checkInResult.error) throw new Error(checkInResult.error.message);
    const enrollment = enrollmentResult.data?.[0];
    if (!enrollment) return { ok: false };

    return {
      ok: true,
      data: {
        firstName: access.firstName,
        programVersion: enrollment.program_version,
        snapshot: acceleratorProgramSnapshotSchema.parse(
          enrollment.program_snapshot,
        ) as AcceleratorProgramSnapshot,
        completedDays: (completionResult.data ?? []).map((row) => row.day_number),
        checkIns: (checkInResult.data ?? []).map(toCheckIn),
      },
    };
  });

export const completeAcceleratorDay = createServerFn({ method: "POST" })
  .validator((data: unknown) => completeAcceleratorDayInputSchema.parse(data))
  .handler(async ({ data }): Promise<AcceleratorProgressResult> => {
    const access = await authorize();
    if (!access) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("complete_accelerator_day_atomic", {
      p_enrollment_id: access.enrollmentId,
      p_program_version: access.programVersion,
      p_day_number: data.day,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return { ok: false };

    return {
      ok: true,
      completedDays: row.completed_days,
      newlyCompleted: row.newly_completed,
      programCompleted: row.program_completed,
    };
  });

export const saveAcceleratorCheckIn = createServerFn({ method: "POST" })
  .validator((data: unknown) => acceleratorCheckInInputSchema.parse(data))
  .handler(async ({ data }): Promise<SaveAcceleratorCheckInResult> => {
    const access = await authorize();
    if (!access) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc(
      "save_accelerator_weekly_check_in_atomic",
      {
        p_enrollment_id: access.enrollmentId,
        p_program_version: access.programVersion,
        p_week_number: data.week,
        p_weight_value: data.weight.value,
        p_weight_unit: data.weight.unit,
        p_waist_value: data.waist.value,
        p_waist_unit: data.waist.unit,
        p_notes: data.notes,
      },
    );
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return { ok: false };
    return { ok: true, checkIn: toCheckIn(row) };
  });
