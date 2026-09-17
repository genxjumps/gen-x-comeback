export function SetupProgress({ currentStep, label }: { currentStep: number; label: string }) {
  return (
    <div
      className="grid max-w-md grid-cols-3 gap-2"
      aria-label={label}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={currentStep}
    >
      {[1, 2, 3].map((step) => {
        const state =
          step < currentStep ? "complete" : step === currentStep ? "current" : "upcoming";

        return (
          <span
            key={step}
            aria-hidden="true"
            className={`h-2 rounded-full ${
              state === "complete"
                ? "bg-[var(--pu-text-primary)]"
                : state === "current"
                  ? "bg-[var(--pu-action-primary)]"
                  : "bg-[var(--pu-surface-subtle)]"
            }`}
          />
        );
      })}
    </div>
  );
}
