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

const assignmentSchema = z.object({ label: z.string().min(1), focus: z.string().min(1) });

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
  day: z.number().int().min(1).max(28),
});

export const undoAcceleratorDayInputSchema = completeAcceleratorDayInputSchema;

export const acceleratorVideoViewInputSchema = z.object({
  day: z.number().int().min(1).max(28),
  mediaKey: z.string().trim().min(1).max(200),
});

export const acceleratorCheckInInputSchema = z.object({
  week: z.number().int().min(1).max(4),
  weight: z.object({ value: z.number().positive(), unit: z.enum(["lb", "kg"]) }),
  waist: z.object({ value: z.number().positive(), unit: z.enum(["in", "cm"]) }),
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((value) => value || null)
    .nullable(),
});
