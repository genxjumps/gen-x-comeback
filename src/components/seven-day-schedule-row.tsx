import { ChevronRight } from "lucide-react";

export type SevenDayScheduleState = "completed" | "current" | "upcoming";

export function SevenDayScheduleRow({
  day,
  title,
  state,
  stateLabel,
}: {
  day: number;
  title: string;
  state: SevenDayScheduleState;
  stateLabel: string;
}) {
  return (
    <div
      className={`grid min-h-20 grid-cols-[2.75rem_1fr_auto] items-center gap-3 px-3 py-4 transition-colors group-hover:bg-foreground/[0.035] ${state === "current" ? "bg-gxj-mint" : state === "completed" ? "text-foreground/45" : "text-foreground"}`}
    >
      <span
        className={`gxj-display-title grid size-9 place-items-center text-lg leading-none ${state === "current" ? "rounded-[2px] bg-gxj-orange text-white" : "text-current"}`}
      >
        {String(day).padStart(2, "0")}
      </span>
      <span className="gxj-display-title block text-lg uppercase leading-tight tracking-wide sm:text-xl">
        {title}
      </span>
      <span className="flex items-center gap-2">
        <span
          className={`hidden text-xs font-bold uppercase tracking-[0.1em] sm:inline ${state === "current" ? "text-gxj-orange" : state === "upcoming" ? "text-foreground/50" : "text-current"}`}
        >
          {stateLabel}
        </span>
        <ChevronRight
          className="size-5 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </span>
    </div>
  );
}
