import {
  ACCELERATOR_ASSIGNMENT_CONTENT,
  ACCELERATOR_ORIENTATION,
  ACCELERATOR_WEEKLY_COACHING,
  type AcceleratorMediaPlaceholder,
} from "./content";

export const ACCELERATOR_PRODUCT_CODE = "accelerator_28" as const;
export const ACCELERATOR_PROGRAM_VERSION = "accelerator_28_v1" as const;

export const ACCELERATOR_OFFER = {
  priceCents: 3_700,
  currency: "USD",
  billing: "one_time",
  refundWindowDays: 7,
  access: "completion_based",
  expiresWhileActive: false,
  includedUpdates: "same_product_only",
} as const;

export const ACCELERATOR_AVAILABILITY = {
  publicEnrollment: false,
  reason: "launch_requirements_unverified",
} as const;

export type AcceleratorWeek = 1 | 2 | 3 | 4;
export type AcceleratorDayNumber =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28;

export type AcceleratorAssignmentCode =
  | "workout_a"
  | "workout_b"
  | "workout_c"
  | "workout_d"
  | "workout_e"
  | "active_recovery_f"
  | "rest";

export const ACCELERATOR_ASSIGNMENTS = {
  workout_a: {
    label: "Workout A - Classic Intervals",
    focus: "Push + Legs",
    instructions:
      "Alternate timed rope work with push-ups and lower-body movements across three circuits. Use regular bounce or knee push-ups when needed, and take extra breaks without worrying about keeping up with Todd.",
    equipment: "Jump rope; optional mat or soft surface",
    runtimeLabel: "Final runtime pending media verification",
    mediaKey: null,
  },
  workout_b: {
    label: "Workout B - EMOM",
    focus: "Conditioning + Core",
    instructions:
      "Warm up before pressing play. Each minute starts with rope skips followed by the assigned movement, and whatever time remains is recovery. Reduce the skips or reps when needed so you can stay in control.",
    equipment: "Jump rope; optional mat or soft surface",
    runtimeLabel: "Final runtime pending media verification",
    mediaKey: null,
  },
  workout_c: {
    label: "Workout C - Lower Body Ladder",
    focus: "Legs + Muscular Endurance",
    instructions:
      "Work through the rope-and-lower-body ladders, then finish with the short lower-body and core circuit. Move through each rep with control and use the scheduled breaks as real recovery.",
    equipment: "Jump rope; optional mat or soft surface",
    runtimeLabel: "Final runtime pending media verification",
    mediaKey: null,
  },
  workout_d: {
    label: "Workout D - Intervals",
    focus: "Jump Conditioning + Full-Body Conditioning",
    instructions:
      "Alternate rope or cardio intervals with controlled bodyweight work. Choose regular bounce or another comfortable rope step whenever a variation is too complex. Good form matters more than reaching every suggested rep.",
    equipment: "Jump rope; optional mat or soft surface",
    runtimeLabel: "Final runtime pending media verification",
    mediaKey: null,
  },
  workout_e: {
    label: "Workout E - Pyramid Challenge",
    focus: "Total-Body Muscular Endurance + Conditioning",
    instructions:
      "Complete the three up-and-down pyramids, then finish with the rope, glute-bridge, and plank-shoulder-tap circuit. Reduce skips or bodyweight reps when needed and treat the single-leg option as optional.",
    equipment: "Jump rope; optional mat or soft surface",
    runtimeLabel: "Final runtime pending media verification",
    mediaKey: null,
  },
  active_recovery_f: {
    label: "Workout F - Active Recovery",
    focus: "Mobility + Recovery",
    instructions:
      "Keep the effort easy enough to speak in full sentences. Easy rope, ghost rope, marching, and walking are equal options. The purpose is light movement and mobility, not another hard training day.",
    equipment: "Jump rope optional; no gym equipment",
    runtimeLabel: "Final runtime pending media verification",
    mediaKey: null,
  },
  rest: {
    label: "Rest Day",
    focus: "Complete recovery",
    instructions:
      "No workout is assigned. Take the full recovery day, then complete the day in the app when you are ready to continue.",
    equipment: "None",
    runtimeLabel: "No workout",
    mediaKey: null,
  },
} as const satisfies Record<
  AcceleratorAssignmentCode,
  {
    label: string;
    focus: string;
    instructions: string;
    equipment: string;
    runtimeLabel: string;
    mediaKey: string | null;
  }
>;

export const ACCELERATOR_EQUIPMENT = {
  program: "Jump rope + bodyweight",
  gymRequired: false,
} as const;

export type AcceleratorDayKind = "primary_workout" | "active_recovery" | "rest";

export type AcceleratorDay = {
  day: AcceleratorDayNumber;
  week: AcceleratorWeek;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  assignment: AcceleratorAssignmentCode;
  kind: AcceleratorDayKind;
  videoRequired: boolean;
  acknowledgementRequired: boolean;
};

export const ACCELERATOR_WEEK_FOCUS = [
  { week: 1, title: "Set Your Baseline" },
  { week: 2, title: "Clean It Up" },
  { week: 3, title: "Raise Your Output" },
  { week: 4, title: "Finish Strong" },
] as const satisfies ReadonlyArray<{ week: AcceleratorWeek; title: string }>;

const WEEKLY_ASSIGNMENTS = [
  { assignment: "workout_a", kind: "primary_workout", videoRequired: true },
  { assignment: "workout_b", kind: "primary_workout", videoRequired: true },
  { assignment: "workout_c", kind: "primary_workout", videoRequired: true },
  { assignment: "workout_d", kind: "primary_workout", videoRequired: true },
  { assignment: "workout_e", kind: "primary_workout", videoRequired: true },
  { assignment: "active_recovery_f", kind: "active_recovery", videoRequired: false },
  { assignment: "rest", kind: "rest", videoRequired: false },
] as const satisfies ReadonlyArray<{
  assignment: AcceleratorAssignmentCode;
  kind: AcceleratorDayKind;
  videoRequired: boolean;
}>;

export const ACCELERATOR_DAYS: ReadonlyArray<AcceleratorDay> = Array.from(
  { length: 28 },
  (_, index) => {
    const day = (index + 1) as AcceleratorDayNumber;
    const week = (Math.floor(index / 7) + 1) as AcceleratorWeek;
    const dayOfWeek = ((index % 7) + 1) as AcceleratorDay["dayOfWeek"];
    const assignment = WEEKLY_ASSIGNMENTS[dayOfWeek - 1];

    return {
      day,
      week,
      dayOfWeek,
      assignment: assignment.assignment,
      kind: assignment.kind,
      videoRequired: assignment.videoRequired,
      acknowledgementRequired: true,
    };
  },
);

export type AcceleratorProgramSnapshot = {
  productCode: typeof ACCELERATOR_PRODUCT_CODE;
  programVersion: typeof ACCELERATOR_PROGRAM_VERSION;
  days: AcceleratorDay[];
  weekFocus: Array<{ week: AcceleratorWeek; title: string }>;
  assignments: Record<
    AcceleratorAssignmentCode,
    {
      label: string;
      focus: string;
      instructions: string;
      equipment: string;
      runtimeLabel: string;
      mediaKey: string | null;
    }
  >;
  equipment: typeof ACCELERATOR_EQUIPMENT;
  orientation: {
    title: string;
    writtenExplanation: string[];
    media: AcceleratorMediaPlaceholder;
  };
  weeklyCoaching: Array<{
    week: AcceleratorWeek;
    title: string;
    guidance: string[];
    media: AcceleratorMediaPlaceholder;
  }>;
  assignmentContent: Record<
    AcceleratorAssignmentCode,
    { instructions: string; media: AcceleratorMediaPlaceholder | null }
  >;
};

/**
 * Enrollment-time content snapshot. Paid enrollments persist this exact value
 * so later source edits cannot rewrite an active participant's history.
 */
export function buildAcceleratorProgramSnapshot(): AcceleratorProgramSnapshot {
  return {
    productCode: ACCELERATOR_PRODUCT_CODE,
    programVersion: ACCELERATOR_PROGRAM_VERSION,
    days: ACCELERATOR_DAYS.map((day) => ({ ...day })),
    weekFocus: ACCELERATOR_WEEK_FOCUS.map((week) => ({ ...week })),
    assignments: Object.fromEntries(
      Object.entries(ACCELERATOR_ASSIGNMENTS).map(([code, assignment]) => [
        code,
        { ...assignment },
      ]),
    ) as AcceleratorProgramSnapshot["assignments"],
    equipment: { ...ACCELERATOR_EQUIPMENT },
    orientation: {
      ...ACCELERATOR_ORIENTATION,
      writtenExplanation: [...ACCELERATOR_ORIENTATION.writtenExplanation],
      media: { ...ACCELERATOR_ORIENTATION.media },
    },
    weeklyCoaching: ACCELERATOR_WEEKLY_COACHING.map((week) => ({
      ...week,
      guidance: [...week.guidance],
      media: { ...week.media },
    })),
    assignmentContent: Object.fromEntries(
      Object.entries(ACCELERATOR_ASSIGNMENT_CONTENT).map(([code, content]) => [
        code,
        {
          ...content,
          media: content.media ? { ...content.media } : null,
        },
      ]),
    ) as AcceleratorProgramSnapshot["assignmentContent"],
  };
}

export type AcceleratorDayAccess = "completed" | "current" | "locked";

/**
 * Completion is sequential. Out-of-order values are ignored until every prior
 * day is complete, matching the server contract the paid program will use.
 */
export function acceleratorDayAccess(
  completedDays: ReadonlySet<number>,
): ReadonlyArray<AcceleratorDay & { access: AcceleratorDayAccess }> {
  return acceleratorDayAccessForDays(ACCELERATOR_DAYS, completedDays);
}

export function acceleratorDayAccessForDays(
  days: ReadonlyArray<AcceleratorDay>,
  completedDays: ReadonlySet<number>,
): ReadonlyArray<AcceleratorDay & { access: AcceleratorDayAccess }> {
  let completedPrefix = 0;

  for (let day = 1; day <= days.length; day += 1) {
    if (!completedDays.has(day)) break;
    completedPrefix = day;
  }

  return days.map((entry) => ({
    ...entry,
    access:
      entry.day <= completedPrefix
        ? "completed"
        : entry.day === completedPrefix + 1
          ? "current"
          : "locked",
  }));
}

export type AcceleratorLaunchRequirement = {
  code:
    | "workout_media"
    | "workout_runtime"
    | "equipment_audit"
    | "weekly_coaching"
    | "nutrition_targets"
    | "progress_tracking"
    | "checkout_handoff"
    | "refund_path"
    | "resume_behavior";
  status: "unverified" | "verified";
};

/**
 * These begin unverified on purpose. Public enrollment must remain closed until
 * a later checkpoint verifies every requirement against the delivered app.
 */
export const ACCELERATOR_LAUNCH_REQUIREMENTS: ReadonlyArray<AcceleratorLaunchRequirement> = [
  { code: "workout_media", status: "unverified" },
  { code: "workout_runtime", status: "unverified" },
  { code: "equipment_audit", status: "unverified" },
  { code: "weekly_coaching", status: "unverified" },
  { code: "nutrition_targets", status: "unverified" },
  { code: "progress_tracking", status: "unverified" },
  { code: "checkout_handoff", status: "unverified" },
  { code: "refund_path", status: "unverified" },
  { code: "resume_behavior", status: "unverified" },
];

export function acceleratorLaunchReady(
  requirements: ReadonlyArray<AcceleratorLaunchRequirement>,
): boolean {
  const requiredCodes = new Set(ACCELERATOR_LAUNCH_REQUIREMENTS.map(({ code }) => code));
  const verifiedCodes = new Set(
    requirements.filter(({ status }) => status === "verified").map(({ code }) => code),
  );

  return (
    requiredCodes.size === ACCELERATOR_LAUNCH_REQUIREMENTS.length &&
    [...requiredCodes].every((code) => verifiedCodes.has(code))
  );
}
