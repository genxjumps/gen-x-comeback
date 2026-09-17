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
  coverSrc,
  href,
  onActivate,
  disabled = false,
}: WorkoutLaunchPanelProps) {
  const program = totalDays === 28 ? "28-Day Accelerator" : "7-Day Plan";

  // Retained while existing callers are migrated away from image-cover props.
  void coverSrc;
  void accent;

  const activate = () => {
    if (disabled) return;
    if (onActivate) {
      onActivate();
      return;
    }
    if (href && typeof window !== "undefined") window.location.assign(href);
  };

  return (
    <div className={`mt-3 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <PuWorkoutMedia
        program={program}
        workoutNumber={day}
        title={title}
        subtitle={`Day ${day} of ${totalDays}`}
        state="ready"
        size="hero"
        actionLabel={`${actionLabel} - Day ${day} of ${totalDays}: ${title}`}
        onAction={activate}
      />
      <p className="mt-2 text-sm font-bold text-[var(--pu-text-primary)]">{actionLabel}</p>
    </div>
  );
}
