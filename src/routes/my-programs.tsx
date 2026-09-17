import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";

import { PlatformPage } from "@/components/platform-page";
import {
  AppList,
  AppListRow,
  AppLoadingState,
  AppNotice,
  AppStatePanel,
} from "@/components/precision-surfaces";
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
      className={`grid size-14 shrink-0 place-items-center rounded-[var(--pu-radius-control)] border ${
        accelerator
          ? "border-[var(--pu-accent-program)] bg-[var(--pu-accent-program-tint)] text-[var(--pu-accent-program)]"
          : "border-[var(--pu-border-strong)] bg-[var(--pu-surface-contained)] text-[var(--pu-text-primary)]"
      }`}
    >
      <span className="flex flex-col items-center leading-none">
        <span className="text-2xl font-extrabold">{days}</span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em]">Day</span>
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

  if (!result) {
    return (
      <PlatformPage title="Your Programs" titleSize="compact">
        <AppLoadingState label="Loading your programs" />
      </PlatformPage>
    );
  }

  if (!result.ok) {
    return (
      <PlatformPage title="Your Programs" titleSize="compact">
        <AppStatePanel
          state="error"
          title="Your programs couldn’t be loaded"
          description="Open Programs again to retry."
        />
      </PlatformPage>
    );
  }

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
      <div className="space-y-12">
        {accelerator || result.leadPlans.length ? (
          <AppList>
            {accelerator ? (
              <AppListRow
                title={
                  <div className="flex items-start gap-4">
                    <ProgramLengthMarker days={28} accelerator />
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-accent-program)]">
                        {statusLabels[accelerator.status]}
                      </p>
                      <h2 className="mt-1 text-2xl font-extrabold leading-tight">
                        Fat Loss Accelerator
                      </h2>
                    </div>
                  </div>
                }
                detail={
                  <div className="pl-[4.5rem]">
                    <p>
                      {accelerator.currentRun
                        ? `${accelerator.currentRun.completedDays} of 28 days complete`
                        : "Owned for life. Start when you’re ready."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {accelerator.status !== "paused" ? (
                        <Button asChild>
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
                          disabled={acting}
                          onClick={() => setConfirmResume(true)}
                        >
                          Resume Program
                        </Button>
                      ) : null}
                      {accelerator.previousRuns.length ? (
                        <Button asChild type="button" variant="outline">
                          <Link to="/my-programs/accelerator/runs">Accelerator History</Link>
                        </Button>
                      ) : null}
                    </div>
                    {confirmResume ? (
                      <AppNotice tone="warning" className="mt-4">
                        <p className="font-bold text-[var(--pu-text-primary)]">
                          Resume your Accelerator?
                        </p>
                        <p className="mt-1">
                          If another structured program is active, it will be paused. Neither
                          program loses progress.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
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
                      </AppNotice>
                    ) : null}
                    {actionError ? (
                      <AppNotice tone="danger" className="mt-4">
                        {actionError}
                      </AppNotice>
                    ) : null}
                  </div>
                }
              />
            ) : null}

            {result.leadPlans.map((plan) => {
              const needsSwitch = plan.status === "paused" && result.activeProgram !== null;
              return (
                <AppListRow
                  key={plan.leadPlanId}
                  title={
                    <div className="flex items-start gap-4">
                      <ProgramLengthMarker days={7} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]">
                          {statusLabels[plan.status]}
                        </p>
                        <h2 className="mt-1 text-2xl font-extrabold leading-tight">
                          Comeback Plan
                        </h2>
                      </div>
                    </div>
                  }
                  detail={
                    <div className="pl-[4.5rem]">
                      <p>
                        {plan.completedDays} of {plan.totalDays} days complete
                      </p>
                      {needsSwitch ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-4"
                          disabled={acting}
                          onClick={() => setConfirmLeadPlanId(plan.leadPlanId)}
                        >
                          Switch to 7-Day Plan
                        </Button>
                      ) : (
                        <Button asChild className="mt-4">
                          <Link to="/your-plan">Open Plan</Link>
                        </Button>
                      )}
                      {confirmLeadPlanId === plan.leadPlanId ? (
                        <AppNotice tone="warning" className="mt-4">
                          <p className="font-bold text-[var(--pu-text-primary)]">
                            Switch to your 7-Day Plan?
                          </p>
                          <p className="mt-1">
                            Your current structured program will be paused. Progress in both
                            programs stays saved.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
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
                        </AppNotice>
                      ) : null}
                    </div>
                  }
                />
              );
            })}
          </AppList>
        ) : (
          <AppStatePanel
            state="empty"
            title="No programs are linked to this account yet"
            description="Available programs are listed below."
          />
        )}

        <section id="available" className="scroll-mt-24">
          <h2 className="text-2xl font-extrabold">Available Programs</h2>
          {accelerator ? (
            <AppStatePanel
              state="empty"
              title="You own every program currently available"
              description="New programs will appear here."
              className="mt-4"
            />
          ) : (
            <AppList className="mt-4">
              <AppListRow
                title={
                  <div className="flex items-start gap-4">
                    <ProgramLengthMarker days={28} accelerator />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-accent-program)]">
                        Available
                      </p>
                      <h3 className="mt-1 text-2xl font-extrabold leading-tight">
                        Fat Loss Accelerator
                      </h3>
                    </div>
                  </div>
                }
                detail={
                  <div className="pl-[4.5rem]">
                    <p>
                      Keep building strength, fitness, and consistency with four weeks of guided
                      workouts and unlocked nutrition tools.
                    </p>
                    <Button asChild className="mt-4">
                      <Link to="/programs/accelerator">
                        View Program <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                }
              />
            </AppList>
          )}
        </section>
      </div>
    </PlatformPage>
  );
}
