import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Pause, Play, Video } from "lucide-react";
import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import { activateLeadPlan } from "@/lib/accelerator/activate-lead-plan";
import { getMyPrograms, pauseAccelerator, resumeAccelerator } from "@/lib/accelerator/functions";
import type { MyProgramsResult } from "@/lib/accelerator/types";

export const Route = createFileRoute("/my-programs")({
  head: () => ({
    meta: [
      { title: "My Programs | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MyPrograms,
});

const statusLabels = {
  not_started: "Not Started",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
} as const;

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
        setActionError("That change couldn’t be saved. Reload My Programs and try again.");
      }
    } catch {
      setActionError("That change couldn’t be saved. Reload My Programs and try again.");
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
        setActionError("That program couldn’t be activated. Reload My Programs and try again.");
        return;
      }
      setConfirmLeadPlanId(null);
      await navigate({ to: "/your-plan" });
    } catch {
      setActionError("That program couldn’t be activated. Reload My Programs and try again.");
    } finally {
      setActing(false);
    }
  }

  return (
    <PlatformPage
      kicker="My Programs"
      title="Your Programs, In One Place"
      description="Programs you own stay here - not started, active, paused, and completed - without erasing previous runs."
    >
      <div className="space-y-4">
        {accelerator ? (
          <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-md bg-muted">
                {accelerator.status === "completed" ? (
                  <Check className="size-5" />
                ) : accelerator.status === "paused" ? (
                  <Pause className="size-5" />
                ) : (
                  <Play className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
                  {statusLabels[accelerator.status]}
                </p>
                <h2 className="mt-1 text-lg font-semibold">28-Day Fat Loss Accelerator</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {accelerator.currentRun
                    ? `Run ${accelerator.currentRun.runNumber} - ${accelerator.currentRun.completedDays} of 28 days complete`
                    : "Owned for life. Start when you’re ready."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {accelerator.status !== "paused" ? (
                    <Button asChild className="w-full sm:w-auto">
                      <Link
                        to={
                          accelerator.status === "not_started" || accelerator.status === "completed"
                            ? "/my-programs/accelerator/setup"
                            : "/accelerator"
                        }
                        search={
                          accelerator.status === "not_started" || accelerator.status === "completed"
                            ? { entitlement: accelerator.entitlementId }
                            : undefined
                        }
                      >
                        {accelerator.status === "not_started"
                          ? "Start Program"
                          : accelerator.status === "completed"
                            ? "Start Another Run"
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
                      <Link to="/my-programs/accelerator/runs">View Previous Runs</Link>
                    </Button>
                  ) : null}
                </div>
                {confirmResume ? (
                  <div className="mt-4 rounded-md border border-border bg-muted/50 p-4">
                    <p className="text-sm font-semibold">Resume this Accelerator run?</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      If another structured program is active, it will be paused. Neither program loses progress.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" size="sm" disabled={acting} onClick={() => void updateRun("resume")}>
                        {acting ? "Resuming..." : "Yes, Resume"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={acting} onClick={() => setConfirmResume(false)}>
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
            <section key={plan.leadPlanId} className="rounded-lg border border-border bg-card p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-md bg-muted">
                  <Video className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
                    {statusLabels[plan.status]}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">7-Day Comeback Plan</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {plan.completedDays} of {plan.totalDays} days complete
                  </p>
                  {needsSwitch ? (
                    <Button type="button" variant="outline" className="mt-4 w-full sm:w-auto" disabled={acting} onClick={() => setConfirmLeadPlanId(plan.leadPlanId)}>
                      Switch to 7-Day Plan
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="mt-4 w-full sm:w-auto">
                      <Link to="/your-plan">Open Plan</Link>
                    </Button>
                  )}
                  {confirmLeadPlanId === plan.leadPlanId ? (
                    <div className="mt-4 rounded-md border border-border bg-muted/50 p-4">
                      <p className="text-sm font-semibold">Switch to your 7-Day Plan?</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Your current structured program will be paused. Progress in both programs stays saved.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button type="button" size="sm" disabled={acting} onClick={() => void switchToLeadPlan(plan.leadPlanId)}>
                          {acting ? "Switching..." : "Yes, Switch"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={acting} onClick={() => setConfirmLeadPlanId(null)}>
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
        {!accelerator && result.leadPlans.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No programs are linked to this account yet.
          </p>
        ) : null}
      </div>
    </PlatformPage>
  );
}
