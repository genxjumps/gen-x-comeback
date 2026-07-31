// Shared (client-safe) constants, schemas, and snapshot helpers for lead capture.
import { z } from "zod";

import { buildPlan, type Answers, type Plan } from "@/lib/plan";

export const CONSENT_VERSION = "v1";
export const CONSENT_COPY =
  "I agree to receive my personalized 7-day plan and occasional fitness emails from Gen X Jumps. I can unsubscribe at any time.";
export const PLAN_LOGIC_VERSION = "plan-engine-v1";
export const ASSESSMENT_LOGIC_VERSION = "assessment-v1";
export const PLAN_FAMILY_LOGIC_VERSION = "plan-family-v1";
export const SCHEDULE_TEMPLATE_VERSION = "availability-templates-v1";
export const WORKOUT_CONTENT_VERSION = "workouts-w01-w07-v1";
export const PROTEIN_LOGIC_VERSION = "protein-v1";

/** Versioned localStorage key holding the raw opaque access token. */
export const ACCESS_TOKEN_STORAGE_KEY = "gxj_plan_token_v1";
/** Legacy boolean marker. Kept only so it can be cleaned up; it never unlocks anything. */
export const LEGACY_ACCESS_MARKER_KEY = "gxj_plan_access_v1";

const NAME_RE = /^[^<>&"`\u0000-\u001f\u007f]{1,60}$/;

export const answersSchema = z
  .object({
    q1: z.enum(["none", "one", "two_three", "four_plus"]),
    q2: z.enum(["long_break", "inconsistent", "active_needs_plan"]),
    q3: z.enum(["no_rope", "new", "short_bursts", "comfortable"]),
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

/** Opaque token: 43-char base64url of 32 random bytes. */
export const RAW_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const regenerateInputSchema = z.object({
  token: z.string().refine((v) => RAW_TOKEN_RE.test(v), "Invalid token"),
  assessment: answersSchema,
});

export const tokenOnlyInputSchema = z.object({
  token: z.string().refine((v) => RAW_TOKEN_RE.test(v), "Invalid token"),
});

export type VerifyAccessResult = { ok: true; firstName: string } | { ok: false };

export const TOTAL_ASSIGNMENTS = 7;

export const completeDayInputSchema = z.object({
  token: z.string().refine((v) => RAW_TOKEN_RE.test(v), "Invalid token"),
  day: z.literal(1),
});

export type ProgressResult = { ok: true; completedDays: number[] } | { ok: false };

/** Display-safe shape of one stored plan day. */
export type PlanDayView = {
  day: number;
  code: string | null;
  title: string;
  description: string | null;
  minutes: number | null;
  optional: { code: string; title: string; description: string; minutes: number } | null;
};

export type PlanHubData = {
  firstName: string;
  tier: string;
  protein: { grams: number | null; fallback: boolean };
  flags: {
    rope: boolean;
    dumbbells: boolean;
    cushionedSurface: boolean;
    impactLimited: boolean;
    floorLimited: boolean;
  };
  days: PlanDayView[];
  completedDays: number[];
};

export type PlanHubResult = { ok: true; data: PlanHubData } | { ok: false };

/** Earliest incomplete day, or null when every assignment is complete. */
export function currentAssignmentDay(days: PlanDayView[], completedDays: number[]): number | null {
  for (const d of days) {
    if (!completedDays.includes(d.day)) return d.day;
  }
  return null;
}

/** Text-only assignment kind, derived from the saved plan. No icons, no branding. */
export function assignmentKind(day: PlanDayView): string {
  if (day.code === "W07") return "Active recovery";
  if (day.code) return "Workout";
  const t = day.title.toLowerCase();
  if (t.includes("walk")) return "Walk or easy movement";
  if (t.includes("recovery")) return "Recovery";
  if (t.includes("rest")) return "Rest";
  return "Assignment";
}




export type SaveLeadPlanResult = { firstName: string; plan: Plan; accessToken: string };
export type RegenerateResult =
  | { ok: true; firstName: string; plan: Plan }
  | { ok: false };

export function buildPlanSnapshot(plan: Plan) {
  return {
    logic: {
      plan: PLAN_LOGIC_VERSION,
      assessment: ASSESSMENT_LOGIC_VERSION,
      planFamily: PLAN_FAMILY_LOGIC_VERSION,
      scheduleTemplates: SCHEDULE_TEMPLATE_VERSION,
      workoutContent: WORKOUT_CONTENT_VERSION,
      protein: PROTEIN_LOGIC_VERSION,
    },
    tier: plan.tier,
    flags: plan.flags,
    protein: { grams: plan.protein.grams, fallback: plan.protein.grams === null },
    days: plan.days.map((d) => ({
      day: d.day,
      code: d.code ?? null,
      title: d.title,
      description: d.description ?? null,
      minutes: d.minutes ?? null,
      optional: d.optional
        ? {
            code: d.optional.code,
            title: d.optional.title,
            description: d.optional.description,
            minutes: d.optional.minutes,
          }
        : null,
    })),
  };
}

export function planFromAnswers(answers: Answers) {
  const plan = buildPlan(answers);
  return { plan, snapshot: buildPlanSnapshot(plan) };
}

/** base64url-encodes bytes without padding. */
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function hashAccessToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
