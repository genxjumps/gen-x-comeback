export type AcceleratorMediaReadiness = "ready_for_cloudflare" | "pending_recording";

export type AcceleratorMediaPlaceholder = {
  readiness: AcceleratorMediaReadiness;
  cloudflareStreamUid: string | null;
  runtimeSeconds: number | null;
};

export const ACCELERATOR_ORIENTATION = {
  title: "Welcome to the 28-Day Fat Loss Accelerator",
  writtenExplanation: [
    "For the next four weeks, follow the plan around training, nutrition, and consistency.",
    "The same core workouts repeat each week on purpose so you can improve execution, pace, control, capacity, and consistency instead of starting over with a different workout every day.",
    "If you miss with the rope, reset and keep moving. If you need more rest, take it. Scale reps or range of motion when needed, and stop if you feel pain rather than normal exercise discomfort.",
    "The goal is not to destroy yourself every workout. Work hard enough to improve, recover, and come back ready to do it again.",
    "Use the Protein-First nutrition guidance and your progress tracking alongside the training. Start where you are, do the work, and give yourself four weeks to see what changes.",
  ],
  media: {
    readiness: "pending_recording",
    cloudflareStreamUid: null,
    runtimeSeconds: null,
  },
} as const;

export const ACCELERATOR_WEEKLY_COACHING = [
  {
    week: 1,
    title: "Set Your Baseline",
    guidance: [
      "Week 1 is about establishing an honest baseline.",
      "Learn the exercises and timing, notice where you need to slow down or can push harder, and figure out how much recovery you actually need.",
      "Do not worry about crushing every workout yet. Get the work in, learn the program, and give yourself a starting point you can improve over the next three weeks.",
    ],
    media: {
      readiness: "pending_recording",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
  {
    week: 2,
    title: "Clean It Up",
    guidance: [
      "Week 2 is about getting cleaner.",
      "Make the rope work smoother, recover faster after misses, make transitions quicker, and use better control on the strength movements.",
      "You do not need to move dramatically faster. Make more of the workout productive with fewer unnecessary stops, cleaner reps, and better rhythm.",
    ],
    media: {
      readiness: "pending_recording",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
  {
    week: 3,
    title: "Raise Your Output",
    guidance: [
      "Week 3 is where you start asking a little more from yourself.",
      "That may mean a faster rope pace, a few more quality reps, shorter unnecessary breaks, better transitions, or staying in the work a little longer before backing off.",
      "Harder does not mean reckless. Work hard, stay under control, and make Week 3 stronger than Week 1.",
    ],
    media: {
      readiness: "pending_recording",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
  {
    week: 4,
    title: "Finish Strong",
    guidance: [
      "Week 4 is about finishing strong and looking for proof of progress.",
      "Compare these workouts with Week 1. Notice whether you are moving faster, doing more quality reps, recovering quicker, handling the rope better, or simply tolerating the same work better.",
      "Do not coast because you are almost finished. Give the final workouts a real effort, then look at what you can do now that you could not do as well four weeks ago.",
    ],
    media: {
      readiness: "pending_recording",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
] as const;

export const ACCELERATOR_ASSIGNMENT_CONTENT = {
  workout_a: {
    instructions:
      "Complete Workout A. Work hard, scale pace, reps, range of motion, and rest when needed, then complete the day when you are finished.",
    media: {
      readiness: "ready_for_cloudflare",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
  workout_b: {
    instructions:
      "Complete Workout B. Stay controlled through each minute, scale reps or rest when needed, then complete the day when you are finished.",
    media: {
      readiness: "ready_for_cloudflare",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
  workout_c: {
    instructions:
      "Complete Workout C. Keep the lower-body work controlled, scale reps or range of motion when needed, then complete the day when you are finished.",
    media: {
      readiness: "ready_for_cloudflare",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
  workout_d: {
    instructions:
      "Complete Workout D using the timed intervals as shown. Scale pace or rest when needed, then complete the day when you are finished.",
    media: {
      readiness: "ready_for_cloudflare",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
  workout_e: {
    instructions:
      "Complete Workout E. Keep the rope work consistent while the bodyweight work builds through the pyramid, scaling reps or rest when needed.",
    media: {
      readiness: "ready_for_cloudflare",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
  active_recovery_f: {
    instructions:
      "Use the Active Recovery session if it helps, then acknowledge the day when your recovery work is complete.",
    media: {
      readiness: "pending_recording",
      cloudflareStreamUid: null,
      runtimeSeconds: null,
    },
  },
  rest: {
    instructions:
      "Take the rest day. No workout is required. Acknowledge the day when you are ready to continue.",
    media: null,
  },
} as const;
