export type WorkoutOverviewItem = {
  label: string;
  value: string;
};

const SEVEN_DAY_WORKOUT_RUNTIMES: Readonly<Record<string, string>> = {
  W01: "15:05",
  W02: "14:30",
  W03: "14:03",
  W04: "14:03",
  W05: "14:00",
  W06: "14:29",
  W07: "14:09",
};

export function sevenDayWorkoutRuntime(code: string, fallbackMinutes = 15): string {
  return SEVEN_DAY_WORKOUT_RUNTIMES[code.toUpperCase()] ?? `${fallbackMinutes}:00`;
}

export function sevenDayWorkoutOverview(code: string, minutes: number): WorkoutOverviewItem[] {
  const recovery = code.toUpperCase() === "W07";
  return [
    { label: "Duration", value: sevenDayWorkoutRuntime(code, minutes) },
    {
      label: "Equipment",
      value: recovery ? "Jump Rope Optional + Body Weight" : "Jump Rope + Body Weight",
    },
    {
      label: "Training",
      value: recovery ? "Recovery + Mobility" : "Conditioning + Strength",
    },
    { label: "Format", value: recovery ? "Guided Movement" : "Intervals + Circuits" },
  ];
}
