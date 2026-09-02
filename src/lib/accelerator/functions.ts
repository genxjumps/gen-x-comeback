import { createServerFn } from "@tanstack/react-start";

import type { AcceleratorProgramSnapshot } from "@/lib/accelerator/program";
import {
  addAcceleratorMeasurementInputSchema,
  acceleratorProgramSnapshotSchema,
  acceleratorAccountInputSchema,
  acceleratorVideoViewInputSchema,
  beginAcceleratorInputSchema,
  completeAcceleratorDayInputSchema,
  correctMeasurementInputSchema,
  removeMeasurementInputSchema,
  programRunActionInputSchema,
  undoAcceleratorDayInputSchema,
} from "@/lib/accelerator/schemas";
import type {
  AcceleratorHubResult,
  BeginAcceleratorResult,
  AcceleratorProgressResult,
  AcceleratorProgressState,
  CustomerMeasurement,
  RecordAcceleratorVideoViewResult,
  RemoveMeasurementResult,
  SaveMeasurementResult,
  UndoAcceleratorDayResult,
  MyProgramsResult,
  ProgramRunActionResult,
} from "@/lib/accelerator/types";
import { latestMeasurementPair, measurementSummary } from "@/lib/accelerator/measurements";
import { nullableRpcArg } from "@/lib/supabase/nullable-rpc-arg";
import { daysWaitingFromAvailableOn } from "@/lib/accelerator/daily-assignment";

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

function toProgressState(
  row: {
    current_day: number | null;
    available_on: string | null;
    can_complete_current: boolean;
    undo_day: number | null;
    undo_until: string | null;
    program_completed: boolean;
  },
  customerTimeZone?: string,
): AcceleratorProgressState {
  return {
    currentDay: row.current_day,
    availableOn: row.available_on,
    canCompleteCurrent: row.can_complete_current,
    undoDay: row.undo_day,
    undoUntil: row.undo_until,
    programCompleted: row.program_completed,
    daysWaiting: customerTimeZone
      ? daysWaitingFromAvailableOn(row.available_on, row.can_complete_current, customerTimeZone)
      : 0,
  };
}

export const getMyPrograms = createServerFn({ method: "POST" })
  .validator((data: unknown) => acceleratorAccountInputSchema.parse(data))
  .handler(async (): Promise<MyProgramsResult> => {
    const { currentAuthorizationHeader, resolveCustomerAccount } =
      await import("@/lib/account/customer-account.server");
    const account = await resolveCustomerAccount(await currentAuthorizationHeader());
    if (!account.ok) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [entitlementResult, runResult, linkResult, activeResult, measurementResult] =
      await Promise.all([
        supabaseAdmin
          .from("paid_product_entitlements")
          .select("id")
          .eq("customer_id", account.account.id)
          .eq("product_code", "accelerator_28")
          .eq("status", "active")
          .limit(1),
        supabaseAdmin
          .from("paid_program_enrollments")
          .select(
            "id, entitlement_id, program_version, run_number, status, started_at, completed_at",
          )
          .eq("customer_id", account.account.id)
          .eq("product_code", "accelerator_28")
          .neq("status", "revoked")
          .order("run_number", { ascending: false }),
        supabaseAdmin
          .from("customer_lead_plan_links")
          .select("lead_plan_id")
          .eq("customer_id", account.account.id),
        supabaseAdmin
          .from("customer_active_programs")
          .select("program_kind, lead_plan_id, paid_enrollment_id")
          .eq("customer_id", account.account.id)
          .limit(1),
        supabaseAdmin
          .from("customer_measurements")
          .select(
            "id, enrollment_id, measurement_kind, value, unit, measurement_context, notes, measured_at, created_at",
          )
          .eq("customer_id", account.account.id)
          .eq("status", "active")
          .order("measured_at", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
    for (const result of [
      entitlementResult,
      runResult,
      linkResult,
      activeResult,
      measurementResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const runs = runResult.data ?? [];
    const runIds = runs.map((run) => run.id);
    const leadPlanIds = (linkResult.data ?? []).map((link) => link.lead_plan_id);
    const [completionResult, leadPlanResult, leadCompletionResult] = await Promise.all([
      runIds.length
        ? supabaseAdmin
            .from("paid_program_day_completions")
            .select("enrollment_id, day_number")
            .in("enrollment_id", runIds)
        : Promise.resolve({ data: [], error: null }),
      leadPlanIds.length
        ? supabaseAdmin.from("lead_plans").select("id, plan_json").in("id", leadPlanIds)
        : Promise.resolve({ data: [], error: null }),
      leadPlanIds.length
        ? supabaseAdmin
            .from("lead_plan_day_completions")
            .select("lead_plan_id, day_number")
            .in("lead_plan_id", leadPlanIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [completionResult, leadPlanResult, leadCompletionResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const active = activeResult.data?.[0] ?? null;
    const measurements = (measurementResult.data ?? []).map(toMeasurement);
    const latestMeasurements = latestMeasurementPair(measurements);
    const runSummaries = runs.map((run) => ({
      enrollmentId: run.id,
      runNumber: run.run_number,
      programVersion: run.program_version,
      status: run.status as "active" | "paused" | "completed",
      completedDays: (completionResult.data ?? []).filter(
        (completion) => completion.enrollment_id === run.id,
      ).length,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      measurementSummary: measurementSummary(measurements, run.id),
    }));
    const entitlement = entitlementResult.data?.[0] ?? null;
    const currentRun =
      runSummaries.find((run) => run.status !== "completed") ?? runSummaries[0] ?? null;
    const accelerator = entitlement
      ? {
          entitlementId: entitlement.id,
          status: (currentRun?.status ?? "not_started") as
            | "not_started"
            | "active"
            | "paused"
            | "completed",
          currentRun,
          previousRuns: currentRun
            ? runSummaries.filter((run) => run.enrollmentId !== currentRun.enrollmentId)
            : [],
        }
      : null;
    const leadPlans = (leadPlanResult.data ?? []).map((plan) => {
      const totalDays =
        plan.plan_json &&
        typeof plan.plan_json === "object" &&
        "days" in plan.plan_json &&
        Array.isArray(plan.plan_json.days)
          ? plan.plan_json.days.length
          : 7;
      const completedDays = (leadCompletionResult.data ?? []).filter(
        (completion) => completion.lead_plan_id === plan.id,
      ).length;
      return {
        leadPlanId: plan.id,
        completedDays,
        totalDays,
        status:
          completedDays >= totalDays
            ? ("completed" as const)
            : active?.program_kind === "lead_plan" && active.lead_plan_id === plan.id
              ? ("active" as const)
              : ("paused" as const),
      };
    });

    return {
      ok: true,
      firstName: account.account.firstName ?? "Jumper",
      accelerator,
      leadPlans,
      activeProgram:
        active?.program_kind === "lead_plan"
          ? "lead_plan"
          : active?.program_kind === "paid_run" &&
              active.paid_enrollment_id &&
              runIds.includes(active.paid_enrollment_id)
            ? "accelerator"
            : active?.program_kind === "paid_run"
              ? "other_program"
              : null,
      latestMeasurements,
    };
  });

export const beginAccelerator = createServerFn({ method: "POST" })
  .validator((data: unknown) => beginAcceleratorInputSchema.parse(data))
  .handler(async ({ data }): Promise<BeginAcceleratorResult> => {
    const { currentAuthorizationHeader, resolveCustomerAccount } =
      await import("@/lib/account/customer-account.server");
    const account = await resolveCustomerAccount(await currentAuthorizationHeader());
    if (!account.ok) return { ok: false, reason: "unauthorized" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const snapshot = (await import("@/lib/accelerator/program")).buildAcceleratorProgramSnapshot();
    const { data: rows, error } = await supabaseAdmin.rpc("begin_accelerator_run_atomic", {
      p_customer_id: account.account.id,
      p_entitlement_id: data.entitlementId,
      p_program_version: snapshot.programVersion,
      p_program_snapshot: snapshot,
      p_customer_time_zone: data.customerTimeZone,
      p_starting_weight: nullableRpcArg(data.weight?.value ?? null),
      p_weight_unit: nullableRpcArg(data.weight?.unit ?? null),
      p_starting_waist: nullableRpcArg(data.waist?.value ?? null),
      p_waist_unit: nullableRpcArg(data.waist?.unit ?? null),
    });
    if (error || !rows?.[0] || rows[0].outcome !== "started" || !rows[0].enrollment_id) {
      return { ok: false, reason: "rejected" };
    }
    return { ok: true, enrollmentId: rows[0].enrollment_id };
  });

export const pauseAccelerator = createServerFn({ method: "POST" })
  .validator((data: unknown) => programRunActionInputSchema.parse(data))
  .handler(async ({ data }): Promise<ProgramRunActionResult> => {
    const access = await authorize();
    if (!access || access.enrollmentId !== data.enrollmentId) return { ok: false };
    const { pauseProgramRun } = await import("@/lib/accelerator/program-runs.server");
    const result = await pauseProgramRun({
      customerAccountId: access.customerAccountId,
      enrollmentId: data.enrollmentId,
    });
    return { ok: true, enrollmentId: result.enrollmentId, pausedAnotherProgram: false };
  });

export const resumeAccelerator = createServerFn({ method: "POST" })
  .validator((data: unknown) => programRunActionInputSchema.parse(data))
  .handler(async ({ data }): Promise<ProgramRunActionResult> => {
    const access = await authorize();
    if (!access || access.enrollmentId !== data.enrollmentId) return { ok: false };
    const { resumeProgramRun } = await import("@/lib/accelerator/program-runs.server");
    const result = await resumeProgramRun({
      customerAccountId: access.customerAccountId,
      enrollmentId: data.enrollmentId,
    });
    return {
      ok: true,
      enrollmentId: result.enrollmentId,
      pausedAnotherProgram: Boolean(result.pausedEnrollmentId || result.pausedLeadPlanId),
    };
  });

export const getAcceleratorHub = createServerFn({ method: "POST" })
  .validator((data: unknown) => acceleratorAccountInputSchema.parse(data))
  .handler(async ({ data }): Promise<AcceleratorHubResult> => {
    const access = await authorize();
    if (!access) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [enrollmentResult, progressResult, measurementResult] = await Promise.all([
      supabaseAdmin
        .from("paid_program_enrollments")
        .select("program_snapshot, program_version, status, customer_time_zone")
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
        entitlementId: access.entitlementId,
        enrollmentId: access.enrollmentId,
        programVersion: enrollment.program_version,
        runStatus: enrollment.status as "active" | "paused" | "completed",
        snapshot: acceleratorProgramSnapshotSchema.parse(
          enrollment.program_snapshot,
        ) as AcceleratorProgramSnapshot,
        completedDays: progress.completed_days,
        progress: toProgressState(progress, enrollment.customer_time_zone),
        measurements,
        measurementSummary: measurementSummary(measurements, access.enrollmentId),
      },
    };
  });

export const completeAcceleratorDay = createServerFn({ method: "POST" })
  .validator((data: unknown) => completeAcceleratorDayInputSchema.parse(data))
  .handler(async ({ data }): Promise<AcceleratorProgressResult> => {
    const access = await authorize();
    if (!access || access.enrollmentId !== data.enrollmentId) return { ok: false };

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
    if (!access || access.enrollmentId !== data.enrollmentId) return { ok: false };

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
    if (!access || access.enrollmentId !== data.enrollmentId) return { ok: false };

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
    if (!access || access.enrollmentId !== data.enrollmentId) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("add_customer_measurement_atomic", {
      p_customer_id: access.customerAccountId,
      p_enrollment_id: data.enrollmentId,
      p_measurement_kind: data.kind,
      p_value: data.value,
      p_unit: data.unit,
      p_measurement_context: data.context,
      p_notes: nullableRpcArg(data.notes),
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
      p_notes: nullableRpcArg(data.notes),
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
