import { ArrowRight } from "lucide-react";

type WorkoutLaunchPanelProps = {
  day: number;
  title: string;
  actionLabel: string;
  href?: string;
  onActivate?: () => void;
  disabled?: boolean;
};

export function WorkoutLaunchPanel({
  day,
  title,
  actionLabel,
  href,
  onActivate,
  disabled = false,
}: WorkoutLaunchPanelProps) {
  const className = `group mt-3 block w-full overflow-hidden rounded-md border border-foreground/70 bg-foreground text-left text-background shadow-[3px_3px_0_color-mix(in_oklch,var(--color-foreground)_14%,transparent)] transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gxj-orange focus-visible:ring-offset-4 ${disabled ? "cursor-wait opacity-70" : ""}`;
  const content = (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="flex min-h-32 flex-col justify-center px-5 py-5 sm:min-h-40 sm:px-7 sm:py-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-background/65 sm:text-sm">
            Day {day} of 7
          </p>
          <h3 className="gxj-display-title mt-2 text-3xl uppercase leading-[0.96] tracking-wide sm:text-4xl">
            {title}
          </h3>
        </div>
        <div className="overflow-hidden bg-background">
          <img
            src={`/workout-covers/day-${String(day).padStart(2, "0")}.webp`}
            alt=""
            className="h-full w-full object-cover object-[70%_center] transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      </div>
      <div className="flex min-h-16 items-center justify-between gap-5 bg-gxj-orange px-5 py-3 text-white sm:px-7">
        <span className="gxj-display-title text-2xl uppercase leading-none sm:text-3xl">
          {actionLabel}
        </span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-gxj-orange transition-transform group-hover:translate-x-1">
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      </div>
    </>
  );

  if (onActivate) {
    return (
      <button
        type="button"
        aria-label={`${actionLabel} - Day ${day}: ${title}`}
        className={className}
        disabled={disabled}
        onClick={onActivate}
      >
        {content}
      </button>
    );
  }

  return (
    <a href={href} aria-label={`${actionLabel} - Day ${day}: ${title}`} className={className}>
      {content}
    </a>
  );
}
