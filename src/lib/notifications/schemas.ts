import { z } from "zod";

export const platformNotificationsInputSchema = z.object({});

export const dismissMeasurementReminderInputSchema = z.object({
  enrollmentId: z.string().uuid(),
  programWeek: z.number().int().min(2).max(4),
});

export const setProgramReminderPreferenceInputSchema = z.object({
  programRemindersEnabled: z.boolean(),
});
