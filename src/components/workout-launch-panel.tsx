import { PuWorkoutMedia } from "@/design-system/precision/components";

type WorkoutLaunchPanelProps = {
  day: number;
  totalDays?: number;
  title: string;
  actionLabel: string;
  accent?: "orange" | "aqua";
  coverSrc?: string;
  href?: string;
  onActivate?: () => void;
  disabled?: boolean;
};

export function WorkoutLaunchPanel({
  day,
  totalDays = 7,
  title,
  actionLabel,
  accent = "orange",
  href,
  onActivate,
  disabled = false,
}: WorkoutLaunchPanelProps) {
  const program = totalDays === 28 ? "28-Day Accelerator" : "7-Day Comeback Plan";
  const week = Math.max(1, Math.ceil(day / 7));

  function activate() {
    if (disabled) return;
    if (onActivate) {
      onActivate();
      return;
    }
    if (href && typeof window !== "undefined") window.location.assign(href);
  }

  return (
    <PuWorkoutMedia
      className={`mt-3 ${accent === "aqua" ? "gxj-workout-media--aqua" : ""} ${
        disabled ? "pointer-events-none opacity-70" : ""
      }`}
      program={program}
      week={week}
      workoutNumber={day}
      title={title}
      subtitle={`Day ${day} of ${totalDays}`}
      state="ready"
      size="hero"
      actionLabel={actionLabel}
      onAction={activate}
    />
  );
}
