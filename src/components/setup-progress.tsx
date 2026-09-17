export function SetupProgress({
  currentStep,
  label,
  labels,
  spacious = false,
}: {
  currentStep: number;
  label: string;
  labels?: readonly string[];
  spacious?: boolean;
}) {
  const steps = labels?.length ? labels.length : 3;

  return (
    <ol
      className={`grid max-w-3xl gap-2 ${steps === 3 ? "grid-cols-3" : ""}`}
      aria-label={label}
      style={steps === 3 ? undefined : { gridTemplateColumns: `repeat(${steps}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: steps }, (_, index) => index + 1).map((step) => {
        const state =
          step < currentStep ? "complete" : step === currentStep ? "current" : "upcoming";

        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className={`flex px-3 ${
              spacious
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
            <span className={`gxj-display-title leading-none tracking-wide ${spacious ? "text-2xl sm:text-3xl" : "text-xl"}`}>
              {String(step).padStart(2, "0")}
            </span>
            {labels?.[step - 1] ? (
              <span className="text-xs font-bold uppercase leading-tight tracking-[0.08em] sm:text-sm">
                {labels[step - 1]}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
