import { createServerFn } from "@tanstack/react-start";

import type { AcceleratorProgramSnapshot } from "@/lib/accelerator/program";
import {
  addAcceleratorMeasurementInputSchema,
  acceleratorProgramSnapshotSchema,
  acceleratorAccountInputSchema,
  acceleratorVideoViewInputSchema,
  completeAcceleratorDayInputSchema,
  correctMeasurementInputSchema,
  removeMeasurementInputSchema,
  undoAcceleratorDayInputSchema,
} from "@/lib/accelerator/schemas";
import type {
  AcceleratorHubResult,
  AcceleratorProgressResult,
  AcceleratorProgressState,
  CustomerMeasurement,
  RecordAcceleratorVideoViewResult,
  RemoveMeasurementResult,
  SaveMeasurementResult,
  UndoAcceleratorDayResult,
} from "@/lib/accelerator/types";
import { measurementSummary } from "@/lib/accelerator/measurements";

async function authorize() {
  const { currentAuthorizationHeader } = await import("@/lib/account/customer-account.server");
  const { resolveAcceleratorAccess } = await import("@/lib/accelerator/access.server");
  return resolveAcceleratorAccess(await currentAuthorizationHeader());
}

function toMeasurement(row: {
  id: string;
  enrollment_id: string | null;
  measurement_kind: string;
  value: number;
  unit: string;
  measurement_context: string;
  notes: string | null;
  measured_at: string;
  created_at: string;
}): CustomerMeasurement {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    kind: row.measurement_kind as CustomerMeasurement["kind"],
    value: Number(row.value),
    unit: row.unit as CustomerMeasurement["unit"],
    context: row.measurement_context as CustomerMeasurement["context"],
    notes: row.notes,
    measuredAt: row.measured_at,
    createdAt: row.created_at,
  };
}

function toProgressState(row: {
  current_day: number | null;
  available_on: string | null;
  can_complete_current: boolean;
  undo_day: number | null;
  undo_until: string | null;
  program_completed: boolean;
}): AcceleratorProgressState {
  return {
    currentDay: row.current_day,
    availableOn: row.available_on,
    canCompleteCurrent: row.can_complete_current,
    undoDay: row.undo_day,
    undoUntil: row.undo_until,
    programCompleted: row.program_completed,
  };
}

export const getAcceleratorHub = createServerFn({ method: "POST" })
  .validator((data: unknown) => acceleratorAccountInputSchema.parse(data))
  .handler(async ({ data }): Promise<AcceleratorHubResult> => {
    const access = await authorize();
    if (!access) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [enrollmentResult, progressResult, measurementResult] = await Promise.all([
      supabaseAdmin
        .from("paid_program_enrollments")
        .select("program_snapshot, program_version")
        .eq("id", access.enrollmentId)
        .eq("program_version", access.programVersion)
        .limit(1),
      supabaseAdmin.rpc("accelerator_progress_state", {
        p_enrollment_id: access.enrollmentId,
        p_program_version: access.programVersion,
      }),
      supabaseAdmin
        .from("customer_measurements")
        .select(
          "id, enrollment_id, measurement_kind, value, unit, measurement_context, notes, measured_at, created_at",
        )
        .eq("customer_id", access.customerAccountId)
        .eq("status", "active")
        .order("measured_at", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (enrollmentResult.error) throw new Error(enrollmentResult.error.message);
    if (progressResult.error) throw new Error(progressResult.error.message);
    if (measurementResult.error) throw new Error(measurementResult.error.message);
    const enrollment = enrollmentResult.data?.[0];
    const progress = progressResult.data?.[0];
    if (!enrollment || !progress) return { ok: false };
    const measurements = (measurementResult.data ?? []).map(toMeasurement);

    return {
      ok: true,
      data: {
        firstName: access.firstName,
        programVersion: enrollment.program_version,
        snapshot: acceleratorProgramSnapshotSchema.parse(
          enrollment.program_snapshot,
        ) as AcceleratorProgramSnapshot,
        completedDays: progress.completed_days,
        progress: toProgressState(progress),
        measurements,
        measurementSummary: measurementSummary(measurements, access.enrollmentId),
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
      progress: toProgressState(row),
    };
  });

export const undoAcceleratorDay = createServerFn({ method: "POST" })
  .validator((data: unknown) => undoAcceleratorDayInputSchema.parse(data))
  .handler(async ({ data }): Promise<UndoAcceleratorDayResult> => {
    const access = await authorize();
    if (!access) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("undo_accelerator_day_atomic", {
      p_enrollment_id: access.enrollmentId,
      p_program_version: access.programVersion,
      p_day_number: data.day,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row || !row.undone) return { ok: false };
    return {
      ok: true,
      completedDays: row.completed_days,
      undone: true,
      progress: toProgressState(row),
    };
  });

export const recordAcceleratorVideoView = createServerFn({ method: "POST" })
  .validator((data: unknown) => acceleratorVideoViewInputSchema.parse(data))
  .handler(async ({ data }): Promise<RecordAcceleratorVideoViewResult> => {
    const access = await authorize();
    if (!access) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("record_accelerator_video_view_atomic", {
      p_enrollment_id: access.enrollmentId,
      p_program_version: access.programVersion,
      p_day_number: data.day,
      p_media_key: data.mediaKey,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return { ok: false };
    return {
      ok: true,
      view: {
        day: row.day_number,
        mediaKey: row.media_key,
        firstViewedAt: row.first_viewed_at,
        lastViewedAt: row.last_viewed_at,
        viewCount: row.view_count,
      },
    };
  });

export const addAcceleratorMeasurement = createServerFn({ method: "POST" })
  .validator((data: unknown) => addAcceleratorMeasurementInputSchema.parse(data))
  .handler(async ({ data }): Promise<SaveMeasurementResult> => {
    const access = await authorize();
    if (!access) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("add_customer_measurement_atomic", {
      p_customer_id: access.customerAccountId,
      p_enrollment_id: access.enrollmentId,
      p_measurement_kind: data.kind,
      p_value: data.value,
      p_unit: data.unit,
      p_measurement_context: data.context,
      p_notes: data.notes,
      p_measured_at: data.measuredAt,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return { ok: false };
    return { ok: true, measurement: toMeasurement(row) };
  });

export const correctCustomerMeasurement = createServerFn({ method: "POST" })
  .validator((data: unknown) => correctMeasurementInputSchema.parse(data))
  .handler(async ({ data }): Promise<SaveMeasurementResult> => {
    const access = await authorize();
    if (!access) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("correct_customer_measurement_atomic", {
      p_customer_id: access.customerAccountId,
      p_measurement_id: data.measurementId,
      p_value: data.value,
      p_unit: data.unit,
      p_notes: data.notes,
      p_measured_at: data.measuredAt,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return { ok: false };
    return { ok: true, measurement: toMeasurement(row) };
  });

export const removeCustomerMeasurement = createServerFn({ method: "POST" })
  .validator((data: unknown) => removeMeasurementInputSchema.parse(data))
  .handler(async ({ data }): Promise<RemoveMeasurementResult> => {
    const access = await authorize();
    if (!access) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("remove_customer_measurement_atomic", {
      p_customer_id: access.customerAccountId,
      p_measurement_id: data.measurementId,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row || !row.removed) return { ok: false };
    return { ok: true, measurementId: row.measurement_id, removed: true };
  });
