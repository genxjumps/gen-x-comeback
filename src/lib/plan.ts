// Deterministic MVP plan derivation for the mocked results page.
// Reads the Checkpoint 2 assessment draft written by src/routes/assessment.index.tsx.

export const ASSESSMENT_STORAGE_KEY = "gxj_assessment_draft_v1";

export type Answers = {
  q1: string; // none | one | two_three | four_plus
  q2: string; // long_break | inconsistent | active_needs_plan
  q3: string; // jump rope experience only: never | new | short_bursts | comfortable ("no_rope" is legacy for never)
  // q4: impact answer stored as an array for backwards compatibility.
  // ["none"] = no impact limit, ["limit_impact"] = needs a lower-impact option.
  q4: string[];
  q5: string; // 3 | 4 | 5 | 6_7
  equipment: string[]; // jump_rope | dumbbells | mat | rubber_flooring | none
  weight: string;
  unit: "lb" | "kg";
};

export const emptyAnswers: Answers = {
  q1: "",
  q2: "",
  q3: "",
  q4: [],
  q5: "",
  equipment: [],
  weight: "",
  unit: "lb",
};

export type Tier = "Restart" | "Rebuild" | "Ready";

export type Workout = {
  code: string;
  title: string;
  description: string;
  minutes: number;
};

export type DayEntry = {
  day: number;
  title: string;
  description?: string;
  minutes?: number;
  equipment?: string;
  code?: string;
  /** Optional recommended Active Recovery session shown on a recovery day. */
  optional?: Workout;
};


export type Plan = {
  tier: Tier;
  days: DayEntry[];
  protein: { grams: number | null };
  flags: {
    rope: boolean;
    dumbbells: boolean;
    cushionedSurface: boolean;
    impactLimited: boolean;
  };
};

// Older drafts stored body-part values that are no longer collected.
// Keep only the impact answer; everything else is discarded.
export function migrateQ4(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  if (values.includes("limit_impact")) return ["limit_impact"];
  if (values.includes("none")) return ["none"];
  return [];
}

export function readAnswers(): Answers {
  try {
    const raw = window.localStorage.getItem(ASSESSMENT_STORAGE_KEY);
    if (!raw) return emptyAnswers;
    const parsed = JSON.parse(raw) as Partial<Answers> | null;
    if (!parsed || typeof parsed !== "object") return emptyAnswers;
    return {
      ...emptyAnswers,
      ...parsed,
      q4: migrateQ4(parsed.q4),
      equipment: Array.isArray(parsed.equipment)
        ? parsed.equipment.filter((v) => typeof v === "string")
        : [],
      unit: parsed.unit === "kg" ? "kg" : "lb",
      weight: typeof parsed.weight === "string" ? parsed.weight : "",
    };
  } catch {
    return emptyAnswers;
  }
}

// Shared allowed answer values. Single source of truth for validation schemas.
export const Q1_VALUES = ["none", "one", "two_three", "four_plus"] as const;
export const Q2_VALUES = ["long_break", "inconsistent", "active_needs_plan"] as const;
// "no_rope" is the legacy value for "never" (kept accepted for older saved drafts).
export const Q3_VALUES = ["never", "no_rope", "new", "short_bursts", "comfortable"] as const;
export const Q4_VALUES = ["none", "limit_impact"] as const;
export const Q5_VALUES = ["3", "4", "5", "6_7"] as const;
export const EQUIPMENT_VALUES = [
  "jump_rope",
  "dumbbells",
  "mat",
  "rubber_flooring",
  "none",
] as const;

/**
 * True when a saved draft has every question answered.
 * Equipment is only checked for at least one selection; weight is not validated here.
 */
export function isCompleteDraft(a: Answers): boolean {
  const q1 = (Q1_VALUES as readonly string[]).includes(a.q1);
  const q2 = (Q2_VALUES as readonly string[]).includes(a.q2);
  const q3 = (Q3_VALUES as readonly string[]).includes(a.q3);
  const q4 = a.q4.length === 1 && (Q4_VALUES as readonly string[]).includes(a.q4[0]);
  const q5 = (Q5_VALUES as readonly string[]).includes(a.q5);
  const equipment = a.equipment.length > 0;
  return q1 && q2 && q3 && q4 && q5 && equipment;
}

// Tier is determined by Q1 (recent workout count) and Q2 (exercise status) only.
export function deriveTier(a: Answers): Tier {
  const q1 = a.q1;
  const q2 = a.q2;
  if (
    !(Q1_VALUES as readonly string[]).includes(q1) ||
    !(Q2_VALUES as readonly string[]).includes(q2)
  )
    return "Restart";
  if (q1 === "none") return "Restart";
  if (q1 === "one") return q2 === "active_needs_plan" ? "Rebuild" : "Restart";
  if (q1 === "two_three") return "Rebuild";
  if (q1 === "four_plus") return q2 === "active_needs_plan" ? "Ready" : "Rebuild";
  return "Restart";
}

export function workoutDays(a: Answers): number {
  if (a.q5 === "6_7") return 6;
  const n = Number(a.q5);
  return Number.isFinite(n) && n >= 3 && n <= 5 ? n : 3;
}

// Protein: 1.0 g per lb, 2.20462 g per kg of current bodyweight, rounded to nearest 5 g.
export function proteinTarget(a: Answers): number | null {
  const raw = a.weight.trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (a.unit === "lb" && (n < 70 || n > 700)) return null;
  if (a.unit === "kg" && (n < 32 || n > 318)) return null;
  const grams = a.unit === "lb" ? n * 1.0 : n * 2.20462;
  return Math.round(grams / 5) * 5;
}

function has(a: Answers, v: string) {
  return a.q4.includes(v);
}

// Locked workout library. Titles, durations, and rundowns are fixed.
export const WORKOUTS: Record<string, Workout> = {
  W01: {
    code: "W01",
    title: "Jump Rope + Full Body",
    description:
      "Short jump rope intervals mixed with sumo squats, push-ups, and seated core work.",
    minutes: 15,
  },
  W02: {
    code: "W02",
    title: "Jump Rope + Upper Body",
    description: "Jump rope intervals combined with push-ups, shoulder taps, and tricep work.",
    minutes: 15,
  },
  W03: {
    code: "W03",
    title: "Jump Rope + Lower Body",
    description: "Jump rope intervals mixed with lunges, glute bridges, and calf raises.",
    minutes: 15,
  },
  W04: {
    code: "W04",
    title: "Jump Rope + Core",
    description: "Jump rope intervals combined with mountain climbers and floor-based core work.",
    minutes: 15,
  },
  W05: {
    code: "W05",
    title: "Jump Rope + Total Body",
    description: "Jump rope intervals mixed with squats, pressing, push-ups, and core stability.",
    minutes: 15,
  },
  W06: {
    code: "W06",
    title: "Jump Rope + Legs",
    description: "Jump rope intervals combined with lateral lunges, squats, and glute work.",
    minutes: 15,
  },
  W07: {
    code: "W07",
    title: "Active Recovery",
    description: "Easy movement, shoulder mobility, and controlled torso rotation.",
    minutes: 15,
  },
};

const WALK = "Walk or easy movement";
const RECOVERY = "Recovery";
const REST = "Rest";

// Fixed seven-day templates keyed by selected workout availability.
// "opt" marks the recovery day that shows W07 as an optional session.
const TEMPLATES: Record<number, Array<string>> = {
  3: ["W01", WALK, "W02", "opt", "W03", WALK, REST],
  4: ["W01", WALK, "W02", "opt", "W03", WALK, "W04"],
  5: ["W01", "W02", "opt", "W03", "W04", RECOVERY, "W05"],
  6: ["W01", "W02", "W03", "W04", "W05", "W06", "W07"],
};

export function buildPlan(a: Answers): Plan {
  const tier = deriveTier(a);
  const impactLimited = has(a, "limit_impact");
  const equip = Array.isArray(a.equipment) ? a.equipment : [];
  const dumbbells = equip.includes("dumbbells");
  const cushionedSurface = equip.includes("mat") || equip.includes("rubber_flooring");
  // Rope availability comes from the equipment answer and impact limitation only.
  // Jump rope experience (q3) never implies ownership.
  const ownsRope = equip.includes("jump_rope");
  const rope = ownsRope && !impactLimited;

  const equipmentNote = dumbbells ? "Dumbbells" : "Bodyweight";
  const surfaceNote = cushionedSurface ? "Mat or cushioned surface" : "";
  const equipmentLine = [equipmentNote, rope ? "Jump rope" : "", surfaceNote]
    .filter(Boolean)
    .join(" \u00b7 ");

  const template = TEMPLATES[workoutDays(a)] ?? TEMPLATES[3];

  const days: DayEntry[] = template.map((slot, i) => {
    const day = i + 1;
    if (slot === "opt") {
      return {
        day,
        title: RECOVERY,
        optional: WORKOUTS.W07,
      };
    }
    const w = WORKOUTS[slot];
    if (w) {
      return {
        day,
        code: w.code,
        title: w.title,
        description: w.description,
        minutes: w.minutes,
        equipment: equipmentLine,
      };
    }
    return { day, title: slot };
  });


  return {
    tier,
    days,
    protein: { grams: proteinTarget(a) },
    flags: { rope, dumbbells, cushionedSurface, impactLimited },
  };
}
