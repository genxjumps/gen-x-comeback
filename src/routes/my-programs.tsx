import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import { activateLeadPlan } from "@/lib/accelerator/activate-lead-plan";
import { getMyPrograms, pauseAccelerator, resumeAccelerator } from "@/lib/accelerator/functions";
import type { MyProgramsResult } from "@/lib/accelerator/types";

export const Route = createFileRoute("/my-programs")({
  head: () => ({
    meta: [{ title: "Programs | Gen X Jumps" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: MyPrograms,
});

const statusLabels = {
  not_started: "Not Started",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
} as const;

const programActionClass =
  "gxj-display-title min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto";

function ProgramLengthMarker({
  days,
  accelerator = false,
}: {
  days: 7 | 28;
  accelerator?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid aspect-square place-items-center ${
        accelerator ? "bg-gxj-aqua text-foreground" : "bg-foreground text-background"
      }`}
    >
      <span className="flex flex-col items-center leading-none">
        <span className="gxj-display-title text-4xl sm:text-5xl">{days}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]">Day</span>
      </span>
    </span>
  );
}

function MyPrograms() {
  const loadPrograms = useServerFn(getMyPrograms);
  const pauseRun = useServerFn(pauseAccelerator);
  const resumeRun = useServerFn(resumeAccelerator);
  const activateSevenDay = useServerFn(activateLeadPlan);
  const navigate = useNavigate();
  const [result, setResult] = useState<MyProgramsResult | null>(null);
  const [confirmResume, setConfirmResume] = useState(false);
  const [confirmLeadPlanId, setConfirmLeadPlanId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadPrograms({ data: {} })
      .then((loaded) => active && setResult(loaded))
      .catch(() => active && setResult({ ok: false }));
    return () => {
      active = false;
    };
  }, [loadPrograms]);

  if (!result) return <p className="text-sm text-muted-foreground">Loading your programs...</p>;
  if (!result.ok)
    return <p className="text-sm text-muted-foreground">Your programs couldn&rsquo;t be loaded.</p>;
  const accelerator = result.accelerator;

  async function updateRun(action: "pause" | "resume") {
    if (!accelerator?.currentRun || acting) return;
    setActing(true);
    setActionError(null);
    try {
      const response = await (action === "pause" ? pauseRun : resumeRun)({
        data: { enrollmentId: accelerator.currentRun.enrollmentId },
      });
      if (response.ok) {
        const refreshed = await loadPrograms({ data: {} });
        setResult(refreshed);
        setConfirmResume(false);
      } else {
        setActionError("That change couldn’t be saved. Reload Programs and try again.");
      }
    } catch {
      setActionError("That change couldn’t be saved. Reload Programs and try again.");
    } finally {
      setActing(false);
    }
  }

  async function switchToLeadPlan(leadPlanId: string) {
    if (acting) return;
    setActing(true);
    setActionError(null);
    try {
      const response = await activateSevenDay({ data: { leadPlanId } });
      if (!response.ok) {
        setActionError("That program couldn’t be activated. Reload Programs and try again.");
        return;
      }
      setConfirmLeadPlanId(null);
      await navigate({ to: "/your-plan" });
    } catch {
      setActionError("That program couldn’t be activated. Reload Programs and try again.");
    } finally {
      setActing(false);
    }
  }

  return (
    <PlatformPage title="Your Programs" titleSize="compact">
      <div className="space-y-10">
        {accelerator || result.leadPlans.length ? (
          <div className="divide-y-2 divide-foreground border-y-2 border-foreground">
            {accelerator ? (
              <section className="py-7 sm:py-8">
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-6">
                  <ProgramLengthMarker days={28} accelerator />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.14em]">
                      {statusLabels[accelerator.status]}
                    </p>
                    <h2 className="gxj-display-title mt-2 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
                      Fat Loss Accelerator
                    </h2>
                    <p className="mt-2 font-medium text-foreground/70">
                      {accelerator.currentRun
                        ? `${accelerator.currentRun.completedDays} of 28 days complete`
                        : "Owned for life. Start when you’re ready."}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {accelerator.status !== "paused" ? (
                        <Button asChild className={programActionClass}>
                          <Link
                            to={
                              accelerator.status === "not_started" ||
                              accelerator.status === "completed"
                                ? "/my-programs/accelerator/setup"
                                : "/accelerator"
                            }
                            search={
                              accelerator.status === "not_started" ||
                              accelerator.status === "completed"
                                ? { entitlement: accelerator.entitlementId }
                                : undefined
                            }
                          >
                            {accelerator.status === "not_started"
                              ? "Set Up My Accelerator"
                              : accelerator.status === "completed"
                                ? "Start the Accelerator Again"
                                : "Continue Program"}
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      ) : null}
                      {accelerator.status === "active" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={programActionClass}
                          disabled={acting}
                          onClick={() => void updateRun("pause")}
                        >
                          {acting ? "Saving..." : "Pause Program"}
                        </Button>
                      ) : null}
                      {accelerator.status === "paused" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={programActionClass}
                          disabled={acting}
                          onClick={() => setConfirmResume(true)}
                        >
                          Resume Program
                        </Button>
                      ) : null}
                      {accelerator.previousRuns.length ? (
                        <Button
                          asChild
                          type="button"
                          variant="outline"
                          className={programActionClass}
                        >
                          <Link to="/my-programs/accelerator/runs">Accelerator History</Link>
                        </Button>
                      ) : null}
                    </div>
                    {confirmResume ? (
                      <div className="mt-4 rounded-md border border-border bg-muted/50 p-4">
                        <p className="text-sm font-semibold">Resume your Accelerator?</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          If another structured program is active, it will be paused. Neither
                          program loses progress.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={acting}
                            onClick={() => void updateRun("resume")}
                          >
                            {acting ? "Resuming..." : "Yes, Resume"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={acting}
                            onClick={() => setConfirmResume(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {actionError ? <p className="mt-3 text-sm font-medium">{actionError}</p> : null}
                  </div>
                </div>
              </section>
            ) : null}

            {result.leadPlans.map((plan) => {
              const needsSwitch = plan.status === "paused" && result.activeProgram !== null;
              return (
                <section key={plan.leadPlanId} className="py-7 sm:py-8">
                  <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-6">
                    <ProgramLengthMarker days={7} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/60">
                        {statusLabels[plan.status]}
                      </p>
                      <h2 className="gxj-display-title mt-2 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
                        Comeback Plan
                      </h2>
                      <p className="mt-2 font-medium text-foreground/70">
                        {plan.completedDays} of {plan.totalDays} days complete
                      </p>
                      {needsSwitch ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={`mt-5 ${programActionClass}`}
                          disabled={acting}
                          onClick={() => setConfirmLeadPlanId(plan.leadPlanId)}
                        >
                          Switch to 7-Day Plan
                        </Button>
                      ) : (
                        <Button asChild className={`mt-5 ${programActionClass}`}>
                          <Link to="/your-plan">Open Plan</Link>
                        </Button>
                      )}
                      {confirmLeadPlanId === plan.leadPlanId ? (
                        <div className="mt-4 rounded-md border border-border bg-muted/50 p-4">
                          <p className="text-sm font-semibold">Switch to your 7-Day Plan?</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Your current structured program will be paused. Progress in both
                            programs stays saved.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={acting}
                              onClick={() => void switchToLeadPlan(plan.leadPlanId)}
                            >
                              {acting ? "Switching..." : "Yes, Switch"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={acting}
                              onClick={() => setConfirmLeadPlanId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <p className="border-y-2 border-foreground py-6 text-sm text-muted-foreground">
            No programs are linked to this account yet.
          </p>
        )}

        <section id="available" className="scroll-mt-24">
          <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
            Available Programs
          </h2>
          {accelerator ? (
            <p className="mt-4 border-t border-foreground/20 pt-4 text-sm text-muted-foreground">
              You own every program currently available. New programs will appear here.
            </p>
          ) : (
            <div className="mt-4 border-y-2 border-foreground py-7 sm:py-8">
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-6">
                <ProgramLengthMarker days={28} accelerator />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.14em]">Available</p>
                  <h3 className="gxj-display-title mt-2 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
                    Fat Loss Accelerator
                  </h3>
                  <p className="mt-2 font-medium leading-relaxed text-foreground/70">
                    Keep building strength, fitness, and consistency with four weeks of guided
                    workouts and unlocked nutrition tools.
                  </p>
                  <Button asChild className={`mt-5 ${programActionClass}`}>
                    <Link to="/programs/accelerator">
                      View Program <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </PlatformPage>
  );
}
