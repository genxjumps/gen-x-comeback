import type { MeasurementReminder } from "@/lib/notifications/measurement-reminder";

export type PlatformNotificationsResult =
  | { ok: true; notifications: MeasurementReminder[] }
  | { ok: false };

export type DismissMeasurementReminderResult = { ok: true; dismissed: true } | { ok: false };
