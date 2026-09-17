type SetupProgressItem = {
  number: number;
  label?: string;
};

export function SetupProgress({
  currentStep,
  label,
  items = [
    { number: 1 },
    { number: 2 },
    { number: 3 },
  ],
  labeled = false,
}: {
  currentStep: number;
  label: string;
  items?: SetupProgressItem[];
  labeled?: boolean;
}) {
  return (
    <ol className={`grid max-w-3xl grid-cols-3 gap-2 ${labeled ? "" : "max-w-md"}`} aria-label={label}>
      {items.map((item) => {
        const state =
          item.number < currentStep
            ? "complete"
            : item.number === currentStep
              ? "current"
              : "upcoming";

        return (
          <li
            key={item.number}
            aria-current={state === "current" ? "step" : undefined}
            className={`flex px-3 ${
              labeled
                ? "min-h-24 flex-col justify-between gap-4 p-3 sm:min-h-28 sm:p-4"
                : "min-h-11 items-center"
            } ${
              state === "complete"
                ? "bg-foreground text-background"
                : state === "current"
                  ? "bg-gxj-orange text-white shadow-[2px_2px_0_color-mix(in_oklch,var(--color-foreground)_18%,transparent)]"
                  : "border-2 border-foreground/20 text-foreground/35"
            }`}
          >
            <span className={`gxj-display-title leading-none tracking-wide ${labeled ? "text-2xl sm:text-3xl" : "text-xl"}`}>
              {String(item.number).padStart(2, "0")}
            </span>
            {labeled && item.label ? (
              <span className="text-xs font-bold uppercase leading-tight tracking-[0.08em] sm:text-sm">
                {item.label}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
