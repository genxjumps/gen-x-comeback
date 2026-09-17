import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppLoading, AppState } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { getMyPrograms } from "@/lib/accelerator/functions";
import type { MyProgramsResult } from "@/lib/accelerator/types";

export function SevenDayNextStep() {
  const loadPrograms = useServerFn(getMyPrograms);
  const [programs, setPrograms] = useState<MyProgramsResult | null>(null);
  useEffect(() => {
    let active = true;
    void loadPrograms({ data: {} }).then(
      (result) => {
        if (active) setPrograms(result);
      },
      () => {
        if (active) setPrograms({ ok: false });
      },
    );
    return () => {
      active = false;
    };
  }, [loadPrograms]);
  const owned = programs?.ok ? programs.accelerator : null;
  return (
    <section className="mt-6 rounded-[var(--pu-radius-contained)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--pu-action-primary)]">
        7 of 7 days complete
      </p>
      <h2 className="mt-3 text-2xl font-semibold">You Finished Your 7-Day Comeback</h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--pu-text-secondary)]">
        You showed up, did the work, and finished. Your completed plan stays saved.
      </p>
      {!programs ? (
        <AppLoading className="mt-5" />
      ) : !programs.ok ? (
        <AppState
          className="mt-5"
          state="error"
          title="Next Step Unavailable"
          description="Open the program page to check your access and next step."
          action={
            <Button asChild>
              <Link to="/programs/accelerator">View the 28-Day Accelerator</Link>
            </Button>
          }
        />
      ) : owned ? (
        <div className="mt-5">
          <h3 className="text-lg font-semibold">Your Accelerator is waiting</h3>
          <p className="mt-2 text-sm text-[var(--pu-text-secondary)]">
            You already own the 28-Day Fat Loss Accelerator. Your nutrition tools are unlocked too.
          </p>
          <Button asChild className="mt-4">
            {owned.status === "not_started" ? (
              <Link
                to="/my-programs/accelerator/setup"
                search={{ entitlement: owned.entitlementId }}
              >
                Set Up My Accelerator
              </Link>
            ) : (
              <Link to="/my-programs">
                {owned.status === "paused"
                  ? "Resume My Accelerator"
                  : owned.status === "completed"
                    ? "View My Accelerator"
                    : "Continue My Accelerator"}
              </Link>
            )}
          </Button>
        </div>
      ) : (
        <div className="mt-5">
          <h3 className="text-xl font-semibold">Keep Going With the 28-Day Accelerator</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--pu-text-secondary)]">
            Build on your first week with guided jump rope and strength workouts, weekly coaching,
            and nutrition tools that put your calorie and macro targets into a practical daily meal
            plan.
          </p>
          <p className="mt-3 text-sm font-medium">$37 once. Keep access for life.</p>
          <Button asChild className="mt-4">
            <Link to="/programs/accelerator">See the 28-Day Accelerator</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
