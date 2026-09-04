import { createServerFn } from "@tanstack/react-start";

import { toCustomerMeasurement } from "@/lib/accelerator/measurement-row";
import { buildComebackReminder } from "@/lib/notifications/comeback-reminder";
import { buildMeasurementReminder } from "@/lib/notifications/measurement-reminder";
import {
  dismissMeasurementReminderInputSchema,
  platformNotificationsInputSchema,
  setProgramReminderPreferenceInputSchema,
} from "@/lib/notifications/schemas";
import type {
  DismissMeasurementReminderResult,
  PlatformComebackReminder,
  PlatformNotification,
  PlatformNotificationsResult,
  ProgramReminderPreferenceResult,
} from "@/lib/notifications/types";

async function programRemindersEnabled(customerId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("customer_program_reminder_preferences")
    .select("program_reminders_enabled")
    .eq("customer_id", customerId)
    .limit(1);
  if (error) throw new Error(error.message);

  // An absent row keeps the default on. This makes the preference additive for
  // existing accounts and gives later reminder channels one shared control.
  return data?.[0]?.program_reminders_enabled ?? true;
}

function laterTimestamp(...values: (string | null | undefined)[]): string | null {
  const valid = values
    .filter(
      (value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)),
    )
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  return valid[0] ?? null;
}

function isPlatformNotification(value: PlatformNotification | null): value is PlatformNotification {
  return value !== null;
}

async function loadPlatformNotificationState() {
  const { currentAuthorizationHeader, resolveCustomerAccount } =
    await import("@/lib/account/customer-account.server");
  const account = await resolveCustomerAccount(await currentAuthorizationHeader());
  if (!account.ok) return { authorized: false as const, customerId: null, reminder: null };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const remindersEnabled = await programRemindersEnabled(account.account.id);
  if (!remindersEnabled) {
    return {
      authorized: true as const,
      customerId: account.account.id,
      reminder: null,
      comeback: null,
    };
  }

  const { data: activeRows, error: activeError } = await supabaseAdmin
    .from("customer_active_programs")
    .select("program_kind, lead_plan_id, paid_enrollment_id, activated_at")
    .eq("customer_id", account.account.id)
    .limit(1);
  if (activeError) throw new Error(activeError.message);
  const active = activeRows?.[0];
  if (!active) {
    return {
      authorized: true as const,
      customerId: account.account.id,
      reminder: null,
      comeback: null,
    };
  }

  if (active.program_kind === "lead_plan" && active.lead_plan_id) {
    const [startResult, completionResult, planResult] = await Promise.all([
      supabaseAdmin
        .from("lead_plan_day_starts")
        .select("started_at")
        .eq("lead_plan_id", active.lead_plan_id)
        .eq("day_number", 1)
        .limit(1),
      supabaseAdmin
        .from("lead_plan_day_completions")
        .select("completed_at")
        .eq("lead_plan_id", active.lead_plan_id)
        .order("completed_at", { ascending: false })
        .limit(8),
      supabaseAdmin.from("lead_plans").select("plan_json").eq("id", active.lead_plan_id).limit(1),
    ]);
    for (const result of [startResult, completionResult, planResult]) {
      if (result.error) throw new Error(result.error.message);
    }
    const planJson = planResult.data?.[0]?.plan_json;
    const planDays =
      planJson && typeof planJson === "object" && !Array.isArray(planJson) ? planJson.days : null;
    const totalDays = Array.isArray(planDays) ? planDays.length : 0;
    const isCompleted = totalDays > 0 && (completionResult.data?.length ?? 0) >= totalDays;
    const startedAt = startResult.data?.[0]?.started_at ?? null;
    const latestCompletedAt = completionResult.data?.[0]?.completed_at ?? null;
    const reminder = buildComebackReminder({
      programStatus: isCompleted ? "completed" : startedAt ? "active" : "not_started",
      programRemindersEnabled: remindersEnabled,
      activityAnchorAt: laterTimestamp(active.activated_at, latestCompletedAt),
      now: new Date().toISOString(),
    });
    return {
      authorized: true as const,
      customerId: account.account.id,
      reminder: null,
      comeback: reminder
        ? ({ ...reminder, target: "/your-plan" } satisfies PlatformComebackReminder)
        : null,
    };
  }

  if (active.program_kind !== "paid_run" || !active.paid_enrollment_id) {
    return {
      authorized: true as const,
      customerId: account.account.id,
      reminder: null,
      comeback: null,
    };
  }

  const { data: enrollmentRows, error: enrollmentError } = await supabaseAdmin
    .from("paid_program_enrollments")
    .select("id, program_version, status")
    .eq("id", active.paid_enrollment_id)
    .eq("customer_id", account.account.id)
    .eq("product_code", "accelerator_28")
    .limit(1);
  if (enrollmentError) throw new Error(enrollmentError.message);
  const enrollment = enrollmentRows?.[0];
  if (!enrollment || enrollment.status !== "active") {
    return {
      authorized: true as const,
      customerId: account.account.id,
      reminder: null,
      comeback: null,
    };
  }

  const { data: latestCompletionRows, error: latestCompletionError } = await supabaseAdmin
    .from("paid_program_day_completions")
    .select("completed_at")
    .eq("enrollment_id", enrollment.id)
    .order("completed_at", { ascending: false })
    .limit(1);
  if (latestCompletionError) throw new Error(latestCompletionError.message);
  const comeback = buildComebackReminder({
    programStatus: "active",
    programRemindersEnabled: remindersEnabled,
    activityAnchorAt: laterTimestamp(active.activated_at, latestCompletionRows?.[0]?.completed_at),
    now: new Date().toISOString(),
  });

  const { data: progressRows, error: progressError } = await supabaseAdmin.rpc(
    "accelerator_progress_state",
    {
      p_enrollment_id: enrollment.id,
      p_program_version: enrollment.program_version,
    },
  );
  if (progressError) throw new Error(progressError.message);
  const progress = progressRows?.[0];
  const currentDay = progress?.current_day ?? null;
  const programWeek = currentDay ? Math.ceil(currentDay / 7) : null;
  if (!progress || !programWeek || programWeek < 2 || programWeek > 4) {
    return {
      authorized: true as const,
      customerId: account.account.id,
      reminder: null,
      comeback: comeback
        ? ({ ...comeback, target: "/accelerator" } satisfies PlatformComebackReminder)
        : null,
    };
  }

  const boundaryDay = (programWeek - 1) * 7;
  const [boundaryResult, measurementResult, dismissalResult] = await Promise.all([
    supabaseAdmin
      .from("paid_program_day_completions")
      .select("completed_at")
      .eq("enrollment_id", enrollment.id)
      .eq("day_number", boundaryDay)
      .limit(1),
    supabaseAdmin
      .from("customer_measurements")
      .select(
        "id, enrollment_id, measurement_kind, value, unit, measurement_context, notes, measured_at, created_at",
      )
      .eq("customer_id", account.account.id)
      .eq("enrollment_id", enrollment.id)
      .eq("status", "active")
      .eq("measurement_context", "progress"),
    supabaseAdmin
      .from("customer_program_reminder_dismissals")
      .select("id")
      .eq("customer_id", account.account.id)
      .eq("enrollment_id", enrollment.id)
      .eq("reminder_code", "weekly_measurement")
      .eq("program_week", programWeek)
      .limit(1),
  ]);
  for (const result of [boundaryResult, measurementResult, dismissalResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    authorized: true as const,
    customerId: account.account.id,
    reminder: buildMeasurementReminder({
      enrollmentId: enrollment.id,
      runStatus: "active",
      currentDay,
      canCompleteCurrent: progress.can_complete_current,
      weekBoundaryCompletedAt: boundaryResult.data?.[0]?.completed_at ?? null,
      measurements: (measurementResult.data ?? []).map(toCustomerMeasurement),
      dismissed: Boolean(dismissalResult.data?.length),
    }),
    comeback: comeback
      ? ({ ...comeback, target: "/accelerator" } satisfies PlatformComebackReminder)
      : null,
  };
}

export const getPlatformNotifications = createServerFn({ method: "POST" })
  .validator((data: unknown) => platformNotificationsInputSchema.parse(data))
  .handler(async (): Promise<PlatformNotificationsResult> => {
    const state = await loadPlatformNotificationState();
    if (!state.authorized) return { ok: false };
    return {
      ok: true,
      notifications: [state.comeback, state.reminder].filter(isPlatformNotification),
    };
  });

export const dismissMeasurementReminder = createServerFn({ method: "POST" })
  .validator((data: unknown) => dismissMeasurementReminderInputSchema.parse(data))
  .handler(async ({ data }): Promise<DismissMeasurementReminderResult> => {
    const state = await loadPlatformNotificationState();
    if (
      !state.authorized ||
      !state.reminder ||
      state.reminder.enrollmentId !== data.enrollmentId ||
      state.reminder.programWeek !== data.programWeek
    ) {
      return { ok: false };
    }

    if (!state.customerId) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("customer_program_reminder_dismissals").insert({
      customer_id: state.customerId,
      enrollment_id: data.enrollmentId,
      reminder_code: "weekly_measurement",
      program_week: data.programWeek,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true, dismissed: true };
  });

export const getProgramReminderPreference = createServerFn({ method: "POST" })
  .validator((data: unknown) => platformNotificationsInputSchema.parse(data))
  .handler(async (): Promise<ProgramReminderPreferenceResult> => {
    const { currentAuthorizationHeader, resolveCustomerAccount } =
      await import("@/lib/account/customer-account.server");
    const account = await resolveCustomerAccount(await currentAuthorizationHeader());
    if (!account.ok) return { ok: false };

    return {
      ok: true,
      programRemindersEnabled: await programRemindersEnabled(account.account.id),
    };
  });

export const setProgramReminderPreference = createServerFn({ method: "POST" })
  .validator((data: unknown) => setProgramReminderPreferenceInputSchema.parse(data))
  .handler(async ({ data }): Promise<ProgramReminderPreferenceResult> => {
    const { currentAuthorizationHeader, resolveCustomerAccount } =
      await import("@/lib/account/customer-account.server");
    const account = await resolveCustomerAccount(await currentAuthorizationHeader());
    if (!account.ok) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("customer_program_reminder_preferences").upsert(
      {
        customer_id: account.account.id,
        program_reminders_enabled: data.programRemindersEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" },
    );
    if (error) throw new Error(error.message);

    return { ok: true, programRemindersEnabled: data.programRemindersEnabled };
  });
