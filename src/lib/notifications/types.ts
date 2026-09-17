import type { MeasurementReminder } from "@/lib/notifications/measurement-reminder";
import type { ComebackReminder } from "@/lib/notifications/comeback-reminder";

export type PlatformComebackReminder = ComebackReminder & {
  target: "/accelerator" | "/your-plan";
};

export type NutritionTargetReviewNotification = {
  code: "nutrition_target_review";
  title: string;
  message: string;
  target: "/nutrition";
};

export type PlatformNotification =
  | MeasurementReminder
  | PlatformComebackReminder
  | NutritionTargetReviewNotification;

export type PlatformNotificationsResult =
  | { ok: true; notifications: PlatformNotification[] }
  | { ok: false };

export type DismissMeasurementReminderResult = { ok: true; dismissed: true } | { ok: false };

export type ProgramReminderPreferenceResult =
  | { ok: true; programRemindersEnabled: boolean }
  | { ok: false };
