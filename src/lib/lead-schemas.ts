// Zod input schemas for lead capture and protected plan server functions.
import { z } from "zod";

import { RAW_TOKEN_RE, TOTAL_ASSIGNMENTS } from "@/lib/lead-plan";
import {
  EQUIPMENT_VALUES,
  Q1_VALUES,
  Q2_VALUES,
  Q3_VALUES,
  Q4_VALUES,
  Q5_VALUES,
} from "@/lib/plan";

// eslint-disable-next-line no-control-regex -- intentionally reject ASCII control characters in lead names
const NAME_RE = /^[^<>&"`\u0000-\u001f\u007f]{1,60}$/;

export const answersSchema = z
  .object({
    q1: z.enum(Q1_VALUES),
    q2: z.enum(Q2_VALUES),
    // "no_rope" is the legacy value for "never" (kept accepted for older saved drafts).
    q3: z.enum(Q3_VALUES),
    q4: z.array(z.enum(Q4_VALUES)).length(1),
    q5: z.enum(Q5_VALUES),
    equipment: z
      .array(z.enum(EQUIPMENT_VALUES))
      .min(1)
      .max(5),
    weight: z.string().max(10),
    unit: z.enum(["lb", "kg"]),
  })
  .superRefine((a, ctx) => {
    if (a.equipment.includes("none") && a.equipment.length > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid equipment selection" });
    }
    const raw = a.weight.trim();
    if (raw === "") return;
    const n = Number(raw);
    const ok =
      Number.isFinite(n) &&
      n > 0 &&
      (a.unit === "lb" ? n >= 70 && n <= 700 : n >= 32 && n <= 318);
    if (!ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid weight" });
    }
  });

/**
 * Access token supplied by the same browser. Optional because an authorized
 * cross-device return-link session cookie can carry access instead.
 */
const optionalTokenSchema = z
  .string()
  .refine((v) => RAW_TOKEN_RE.test(v), "Invalid token")
  .nullish();

/** SHA-256 hex digest of a client-generated same-browser access token. */
const tokenHashSchema = z.string().regex(/^[a-f0-9]{64}$/, "Invalid token hash");

/** Required client-generated idempotency key for an exact submit replay. */
const submissionIdSchema = z.string().uuid("Invalid submission id");

export const leadInputSchema = z.object({
  submissionId: submissionIdSchema,
  sessionTokenHash: tokenHashSchema,
  
  firstName: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => NAME_RE.test(v), "Invalid first name"),
  email: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => z.string().email().max(254).safeParse(v).success, "Invalid email"),
  consentGranted: z.literal(true),
  assessment: answersSchema,
});

export const regenerateInputSchema = z.object({
  submissionId: submissionIdSchema,
  sessionTokenHash: tokenHashSchema,
  token: optionalTokenSchema,
  assessment: answersSchema,
});

export const tokenOnlyInputSchema = z.object({
  token: optionalTokenSchema,
});

/** Valid plan day number: 1 through 7 only. */
export const planDaySchema = z.number().int().min(1).max(TOTAL_ASSIGNMENTS);

export const completeDayInputSchema = z.object({
  token: optionalTokenSchema,
  day: planDaySchema,
});

export const dayBriefInputSchema = z.object({
  token: optionalTokenSchema,
  day: planDaySchema,
});
