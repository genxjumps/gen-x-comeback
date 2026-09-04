import { z } from "zod";

const acceleratorDaySchema = z.object({
  day: z.number().int().min(1).max(28),
  week: z.number().int().min(1).max(4),
  dayOfWeek: z.number().int().min(1).max(7),
  assignment: z.enum([
    "workout_a",
    "workout_b",
    "workout_c",
    "workout_d",
    "workout_e",
    "active_recovery_f",
    "rest",
  ]),
  kind: z.enum(["primary_workout", "active_recovery", "rest"]),
  videoRequired: z.boolean(),
  acknowledgementRequired: z.literal(true),
});

const assignmentSchema = z.object({
  label: z.string().min(1),
  focus: z.string().min(1),
});

const mediaReadinessSchema = z.enum(["ready_for_cloudflare", "uploaded", "pending_recording"]);

const mediaPlaceholderSchema = z.object({
  readiness: mediaReadinessSchema,
  cloudflareStreamUid: z.string().trim().min(1).max(200).nullable(),
  runtimeSeconds: z.number().int().positive().nullable(),
});

const assignmentContentSchema = z.object({
  instructions: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1).optional(),
  media: mediaPlaceholderSchema.nullable(),
});

export const acceleratorProgramSnapshotSchema = z
  .object({
    productCode: z.literal("accelerator_28"),
    programVersion: z.literal("accelerator_28_v1"),
    days: z.array(acceleratorDaySchema).length(28),
    weekFocus: z
      .array(z.object({ week: z.number().int().min(1).max(4), title: z.string().min(1) }))
      .length(4),
    assignments: z.object({
      workout_a: assignmentSchema,
      workout_b: assignmentSchema,
      workout_c: assignmentSchema,
      workout_d: assignmentSchema,
      workout_e: assignmentSchema,
      active_recovery_f: assignmentSchema,
      rest: assignmentSchema,
    }),
    equipment: z.object({ program: z.string().min(1), gymRequired: z.boolean() }),
    orientation: z.object({
      title: z.string().min(1),
      writtenExplanation: z.array(z.string().min(1)).min(1),
      media: mediaPlaceholderSchema,
    }),
    weeklyCoaching: z
      .array(
        z.object({
          week: z.number().int().min(1).max(4),
          title: z.string().min(1),
          guidance: z.array(z.string().min(1)).min(1),
          media: mediaPlaceholderSchema,
        }),
      )
      .length(4),
    assignmentContent: z.object({
      workout_a: assignmentContentSchema,
      workout_b: assignmentContentSchema,
      workout_c: assignmentContentSchema,
      workout_d: assignmentContentSchema,
      workout_e: assignmentContentSchema,
      active_recovery_f: assignmentContentSchema,
      rest: assignmentContentSchema,
    }),
  })
  .superRefine((snapshot, context) => {
    snapshot.days.forEach((day, index) => {
      const expectedDay = index + 1;
      if (
        day.day !== expectedDay ||
        day.week !== Math.floor(index / 7) + 1 ||
        day.dayOfWeek !== (index % 7) + 1
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["days", index],
          message: "Invalid sequential program day",
        });
      }
    });
  });

export const acceleratorAccountInputSchema = z.object({});

export const completeAcceleratorDayInputSchema = z.object({
  enrollmentId: z.string().uuid(),
  day: z.number().int().min(1).max(28),
});

export const undoAcceleratorDayInputSchema = completeAcceleratorDayInputSchema;

export const acceleratorVideoViewInputSchema = z.object({
  enrollmentId: z.string().uuid(),
  day: z.number().int().min(1).max(28),
  mediaKey: z.string().trim().min(1).max(200),
});

const measurementValueSchema = z
  .object({
    kind: z.enum(["weight", "waist"]),
    value: z.number().positive(),
    unit: z.enum(["lb", "kg", "in", "cm"]),
  })
  .superRefine((measurement, context) => {
    if (
      (measurement.kind === "weight" && !["lb", "kg"].includes(measurement.unit)) ||
      (measurement.kind === "waist" && !["in", "cm"].includes(measurement.unit))
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["unit"], message: "Invalid unit" });
    }
  });

const measurementDetailsSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((value) => value || null)
    .nullable(),
  measuredAt: z.string().datetime(),
});

export const addAcceleratorMeasurementInputSchema = measurementValueSchema.and(
  measurementDetailsSchema.extend({
    enrollmentId: z.string().uuid(),
    context: z.enum(["starting", "progress", "final"]),
  }),
);

export const correctMeasurementInputSchema = measurementValueSchema.and(
  measurementDetailsSchema.extend({ measurementId: z.string().uuid() }),
);

export const removeMeasurementInputSchema = z.object({ measurementId: z.string().uuid() });

export const beginAcceleratorInputSchema = z.object({
  entitlementId: z.string().uuid(),
  customerTimeZone: z.string().trim().min(1).max(100),
  weight: z.object({ value: z.number().positive(), unit: z.enum(["lb", "kg"]) }).nullable(),
  waist: z.object({ value: z.number().positive(), unit: z.enum(["in", "cm"]) }).nullable(),
});

export const programRunActionInputSchema = z.object({ enrollmentId: z.string().uuid() });
