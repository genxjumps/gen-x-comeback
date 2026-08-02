// Zod input schemas for lead capture and protected plan server functions.
import { z } from "zod";

import { RAW_TOKEN_RE, TOTAL_ASSIGNMENTS } from "@/lib/lead-plan";

const NAME_RE = /^[^<>&"`\u0000-\u001f\u007f]{1,60}$/;

export const answersSchema = z
  .object({
    q1: z.enum(["none", "one", "two_three", "four_plus"]),
    q2: z.enum(["long_break", "inconsistent", "active_needs_plan"]),
    // "no_rope" is the legacy value for "never" (kept accepted for older saved drafts).
    q3: z.enum(["never", "no_rope", "new", "short_bursts", "comfortable"]),
    q4: z.array(z.enum(["none", "limit_impact"])).length(1),
    q5: z.enum(["3", "4", "5", "6_7"]),
    equipment: z
      .array(z.enum(["jump_rope", "dumbbells", "mat", "rubber_flooring", "none"]))
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

export const leadInputSchema = z.object({
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
  token: z.string().refine((v) => RAW_TOKEN_RE.test(v), "Invalid token"),
  assessment: answersSchema,
});

export const tokenOnlyInputSchema = z.object({
  token: z.string().refine((v) => RAW_TOKEN_RE.test(v), "Invalid token"),
});

/** Valid plan day number: 1 through 7 only. */
export const planDaySchema = z.number().int().min(1).max(TOTAL_ASSIGNMENTS);

export const completeDayInputSchema = z.object({
  token: z.string().refine((v) => RAW_TOKEN_RE.test(v), "Invalid token"),
  day: planDaySchema,
});

export const dayBriefInputSchema = z.object({
  token: z.string().refine((v) => RAW_TOKEN_RE.test(v), "Invalid token"),
  day: planDaySchema,
});
