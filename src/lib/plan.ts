// Deterministic MVP plan derivation for the mocked results page.
// Reads the Checkpoint 2 assessment draft written by src/routes/assessment.index.tsx.

export const ASSESSMENT_STORAGE_KEY = "gxj_assessment_draft_v1";

export type Answers = {
  q1: string; // none | one | two_three | four_plus
  q2: string; // long_break | inconsistent | active_needs_plan
  q3: string; // no_rope | new | short_bursts | comfortable
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

export type DayEntry = {
  day: number;
  title: string;
  description?: string;
  minutes?: number;
  equipment?: string;
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
    floorLimited: boolean;
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

export function deriveTier(a: Answers): Tier {
  let score = 0;
  if (a.q1 === "one") score += 1;
  if (a.q1 === "two_three") score += 2;
  if (a.q1 === "four_plus") score += 3;
  if (a.q2 === "inconsistent") score += 1;
  if (a.q2 === "active_needs_plan") score += 3;
  if (a.q3 === "short_bursts") score += 1;
  if (a.q3 === "comfortable") score += 2;
  if (a.q5 === "5") score += 1;
  if (a.q5 === "6_7") score += 2;
  if (score >= 7) return "Ready";
  if (score >= 3) return "Rebuild";
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

export function buildPlan(a: Answers): Plan {
  const tier = deriveTier(a);
  const impactLimited = has(a, "limit_impact") || has(a, "knees") || has(a, "balance");
  const floorLimited = has(a, "floor_access");
  const equip = Array.isArray(a.equipment) ? a.equipment : [];
  const dumbbells = equip.includes("dumbbells");
  const cushionedSurface = equip.includes("mat") || equip.includes("rubber_flooring");
  const ownsRope = equip.includes("jump_rope");
  const ropeExperienceAllows = a.q3 !== "no_rope" && a.q3 !== "";
  const rope = ownsRope && ropeExperienceAllows && !impactLimited;

  const equipment = dumbbells ? "Dumbbells" : "Bodyweight";
  const standingNote = floorLimited ? `${equipment} · Standing only` : equipment;

  const strengthTitle = `${floorLimited ? "Standing " : ""}Full-Body ${
    dumbbells ? "Dumbbell Strength" : "Strength"
  }`;


  const surfaceNote = cushionedSurface ? "Mat or cushioned surface" : "";
  const cardioTitle = rope
    ? "Jump Rope and Full-Body Strength"
    : impactLimited
      ? "Low-Impact Cardio and Strength"
      : "Step Cardio and Full-Body Strength";

  // Approved baseline Day 1 description, with a minimal standing-only adaptation.
  const dayOneDescription = floorLimited
    ? "You\u2019ll move through a standing full-body workout that blends strength, cardio, and recovery-friendly pacing so you finish feeling worked, not wrecked."
    : "You\u2019ll move through a full-body workout that blends strength, cardio, and recovery-friendly pacing so you finish feeling worked, not wrecked.";

  const dayOneByTier: Record<Tier, { title: string; description: string; minutes: number }> = {
    Restart: {
      title: "Full-Body Comeback Workout",
      description: dayOneDescription,
      minutes: 20,
    },
    Rebuild: {
      title: "Full-Body Rebuild Workout",
      description: dayOneDescription,
      minutes: 24,
    },
    Ready: {
      title: "Full-Body Strength and Conditioning",
      description: dayOneDescription,
      minutes: 28,
    },
  };

  const rotationByTier: Record<Tier, string[]> = {
    Restart: [strengthTitle, cardioTitle, strengthTitle, cardioTitle, strengthTitle],
    Rebuild: [cardioTitle, strengthTitle, cardioTitle, strengthTitle, cardioTitle],
    Ready: [strengthTitle, cardioTitle, strengthTitle, cardioTitle, "Conditioning Finisher"],
  };

  const recoveryTitles = floorLimited
    ? ["Recovery and Standing Mobility", "Active Recovery Walk", "Rest and Reset"]
    : ["Recovery and Mobility", "Active Recovery", "Rest and Reset"];

  const total = workoutDays(a);
  const rotation = rotationByTier[tier];
  const one = dayOneByTier[tier];

  const days: DayEntry[] = [
    {
      day: 1,
      title: one.title,
      description: one.description,
      minutes: one.minutes,
      equipment: [standingNote, rope ? "Jump rope" : "", surfaceNote]
        .filter(Boolean)
        .join(" \u00b7 "),
    },
  ];

  let workoutsPlaced = 1;
  let recoveryIndex = 0;
  for (let day = 2; day <= 7; day++) {
    const remainingDays = 7 - day + 1;
    const remainingWorkouts = total - workoutsPlaced;
    // Alternate: insert recovery after each workout when frequency allows.
    const previousWasWorkout = !days[days.length - 1].title.match(/Recovery|Rest/);
    const needsAll = remainingWorkouts >= remainingDays;
    if (remainingWorkouts > 0 && (needsAll || !previousWasWorkout || total >= 6)) {
      days.push({ day, title: rotation[(workoutsPlaced - 1) % rotation.length] });
      workoutsPlaced += 1;
    } else {
      days.push({ day, title: recoveryTitles[recoveryIndex % recoveryTitles.length] });
      recoveryIndex += 1;
    }
  }

  return {
    tier,
    days,
    protein: { grams: proteinTarget(a) },
    flags: { rope, dumbbells, cushionedSurface, impactLimited, floorLimited },
  };
}
