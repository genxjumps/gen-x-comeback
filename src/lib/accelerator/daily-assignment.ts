const DAY_MS = 86_400_000;

function isoDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dateOrdinal(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);
}

export function daysWaitingFromAvailableOn(
  availableOn: string | null,
  canCompleteCurrent: boolean,
  customerTimeZone: string,
  now = new Date(),
): number {
  if (!availableOn || !canCompleteCurrent) return 0;
  const today = isoDateInTimeZone(now, customerTimeZone);
  return Math.max(0, dateOrdinal(today) - dateOrdinal(availableOn));
}

export function missedDayMessage(daysWaiting: number): string | null {
  if (daysWaiting <= 0) return null;
  if (daysWaiting === 1) {
    return "Life happens. You haven't lost your place, and today's assignment is ready when you are.";
  }
  if (daysWaiting === 2) {
    return "No catching up and no doubled workout. Pick up with this assignment when you're ready.";
  }
  return "Your jump rope didn't file a missing-person report. Your next assignment is still right here.";
}
