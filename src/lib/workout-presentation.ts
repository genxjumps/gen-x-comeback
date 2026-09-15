export type WorkoutOverviewItem = {
  label: string;
  value: string;
};

export function sevenDayWorkoutOverview(code: string, minutes: number): WorkoutOverviewItem[] {
  const recovery = code.toUpperCase() === "W07";
  return [
    { label: "Duration", value: `${minutes} Minutes` },
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
