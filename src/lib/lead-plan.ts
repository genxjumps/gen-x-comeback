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

/** Valid plan day number: 1 through 7 only. */
export const planDaySchema = z.number().int().min(1).max(TOTAL_ASSIGNMENTS);

export const completeDayInputSchema = z.object({
  token: z.string().refine((v) => RAW_TOKEN_RE.test(v), "Invalid token"),
  day: planDaySchema,
});


export type ProgressResult = { ok: true; completedDays: number[] } | { ok: false };

/**
 * Minimal server-derived inputs for Day 1 cardio guidance.
 * Ownership comes from the saved equipment answer, never from rope experience.
 */
export type CardioContext = {
  impactLimited: boolean;
  ownsRope: boolean;
  ropeLevel: "beginner" | "short_bursts" | "comfortable";
};

export type DayOneBriefResult =
  | { ok: true; cardio: CardioContext; completedDays: number[] }
  | { ok: false };

/**
 * Server-authoritative brief for a protected day page: guidance plus the saved
 * assignment for that day, its tier, and current completion state.
 */
export type DayBriefResult =
  | {
      ok: true;
      cardio: CardioContext;
      completedDays: number[];
      tier: string;
      day: PlanDayView | null;
    }
  | { ok: false };

/** Tier-appropriate easy-movement duration for a saved walk assignment. */
export function movementDuration(tier: string): string {
  if (tier === "Ready") return "20 to 30 minutes";
  if (tier === "Rebuild") return "About 20 minutes";
  return "10 to 20 minutes";
}



/** Maps a saved q3 value to a guidance level. Legacy "no_rope" means "never". */
export function ropeLevelFromExperience(q3: string): CardioContext["ropeLevel"] {
  if (q3 === "comfortable") return "comfortable";
  if (q3 === "short_bursts") return "short_bursts";
  return "beginner"; // never | no_rope (legacy) | new
}

/** Day 1 cardio instruction. Lower-impact guidance overrides all rope guidance. */
export function cardioGuidance(c: CardioContext): string {
  if (c.impactLimited) {
    return "During every jump rope interval, march in place or use step-touches instead of jumping. Keep one foot on the floor the entire time and drive the pace with your arms and your breathing.";
  }
  if (!c.ownsRope) {
    return "Use ghost jumps for every cardio interval. Ghost jumps are small two-foot hops while you turn your hands as though you were holding a rope.";
  }
  if (c.ropeLevel === "beginner") {
    return "Try the rope at the start of each interval. When resetting the rope takes over more than the jumping does, put it down and finish the interval with ghost jumps. Ghost jumps are small two-foot hops while you turn your hands as though you were holding a rope.";
  }
  if (c.ropeLevel === "short_bursts") {
    return "Use the rope while your rhythm is clean, then finish the interval with ghost jumps as needed. Ghost jumps are small two-foot hops while you turn your hands as though you were holding a rope.";
  }
  return "Use the rope normally for every cardio interval and scale your pace as needed. Slow the turns down before you break your rhythm.";
}

/** Display-safe shape of one stored plan day. */
export type PlanDayView = {
  day: number;
  code: string | null;
  title: string;
  description: string | null;
  minutes: number | null;
  optional: { code: string; title: string; description: string; minutes: number } | null;
};

/** Normalizes one stored plan-day record into the display-safe shape. */
export function toPlanDayView(d: Record<string, unknown>, index: number): PlanDayView {
  const opt = d.optional as
    | { code?: string; title?: string; description?: string; minutes?: number }
    | null
    | undefined;
  return {
    day: typeof d.day === "number" ? d.day : index + 1,
    code: typeof d.code === "string" ? d.code : null,
    title: typeof d.title === "string" ? d.title : "Assignment",
    description: typeof d.description === "string" ? d.description : null,
    minutes: typeof d.minutes === "number" ? d.minutes : null,
    optional: opt
      ? {
          code: String(opt.code ?? ""),
          title: String(opt.title ?? ""),
          description: String(opt.description ?? ""),
          minutes: typeof opt.minutes === "number" ? opt.minutes : 15,
        }
      : null,
  };
}

export const dayBriefInputSchema = z.object({
  token: z.string().refine((v) => RAW_TOKEN_RE.test(v), "Invalid token"),
  day: planDaySchema,
});

/** Delivery kind for a saved assignment day, derived from the saved plan only. */
export type AssignmentType = "workout" | "walk" | "recovery" | "rest";

export function assignmentType(day: PlanDayView | null): AssignmentType {
  if (!day) return "rest";
  if (day.code) return "workout";
  const t = day.title.toLowerCase();
  if (t.includes("walk") || t.includes("movement")) return "walk";
  if (t.includes("recovery")) return "recovery";
  return "rest";
}

/** Completion button label for a saved assignment day. */
export function completionLabel(day: PlanDayView | null, dayNumber: number): string {
  switch (assignmentType(day)) {
    case "walk":
      return "Mark Movement Complete";
    case "recovery":
      return "Mark Recovery Complete";
    case "rest":
      return "Mark Rest Day Complete";
    default:
      return `Mark Day ${dayNumber} Complete`;
  }
}



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
