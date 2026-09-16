export function SetupProgress({ currentStep, label }: { currentStep: number; label: string }) {
  return (
    <ol className="grid max-w-md grid-cols-3 gap-2" aria-label={label}>
      {[1, 2, 3].map((step) => {
        const state =
          step < currentStep ? "complete" : step === currentStep ? "current" : "upcoming";

        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className={`flex min-h-11 items-center px-3 ${
              state === "complete"
                ? "bg-foreground text-background"
                : state === "current"
                  ? "bg-gxj-orange text-white shadow-[2px_2px_0_color-mix(in_oklch,var(--color-foreground)_18%,transparent)]"
                  : "border-2 border-foreground/20 text-foreground/35"
            }`}
          >
            <span className="gxj-display-title text-xl leading-none tracking-wide">
              {String(step).padStart(2, "0")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
