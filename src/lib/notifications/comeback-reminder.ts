const HOUR_MS = 60 * 60 * 1000;
const FOUR_DAYS_MS = 4 * 24 * HOUR_MS;
const TEN_DAYS_MS = 10 * 24 * HOUR_MS;

export type ComebackReminder = {
  code: "comeback_4_days" | "comeback_10_days";
  title: string;
  message: string;
};

export type ComebackReminderInput = {
  programStatus: "not_started" | "active" | "paused" | "completed" | "revoked";
  programRemindersEnabled: boolean;
  activityAnchorAt: string | null;
  now: string;
};

/**
 * Resolves the current in-app comeback message for one active structured
 * program. The activity anchor is the later of the current activation/resume
 * time and the latest completed workout, so returning to a program starts a
 * fresh sequence without using app opens as activity.
 *
 * Email delivery has its own future, idempotent delivery record. This helper
 * deliberately has no side effects and never sends email.
 */
export function buildComebackReminder(input: ComebackReminderInput): ComebackReminder | null {
  if (input.programStatus !== "active" || !input.programRemindersEnabled) return null;

  const activityAnchor = input.activityAnchorAt ? Date.parse(input.activityAnchorAt) : Number.NaN;
  const now = Date.parse(input.now);
  if (!Number.isFinite(activityAnchor) || !Number.isFinite(now) || now < activityAnchor)
    return null;

  const elapsed = now - activityAnchor;
  if (elapsed < FOUR_DAYS_MS) return null;

  if (elapsed < TEN_DAYS_MS) {
    return {
      code: "comeback_4_days",
      title: "Your next workout is waiting",
      message:
        "You don’t need to make up anything. Open the app, do today’s workout, and keep moving.",
    };
  }

  return {
    code: "comeback_10_days",
    title: "Your program’s still here",
    message:
      "Nothing’s ruined. You don’t need to restart or catch up. Your next workout is waiting when you’re ready.",
  };
}
