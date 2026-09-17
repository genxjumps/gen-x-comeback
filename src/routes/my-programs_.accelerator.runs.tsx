import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PlatformPage } from "@/components/platform-page";
import { AppLoadingState, AppStatePanel } from "@/components/precision-surfaces";
import { Button } from "@/components/ui/button";
import { getMyPrograms } from "@/lib/accelerator/functions";
import { measurementChange } from "@/lib/accelerator/measurements";
import type { CustomerMeasurement, MyProgramsResult } from "@/lib/accelerator/types";

export const Route = createFileRoute("/my-programs_/accelerator/runs")({
  head: () => ({
    meta: [
      { title: "Accelerator History | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PreviousRuns,
});

function runDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function measurementValue(measurement: CustomerMeasurement | null): string {
  return measurement ? `${measurement.value} ${measurement.unit}` : "Not recorded";
}

function changeValue(
  starting: CustomerMeasurement | null,
  final: CustomerMeasurement | null,
): string {
  const change = measurementChange(starting, final);
  if (!change) return "Not enough information";
  const rounded = Math.round(Math.abs(change.value) * 10) / 10;
  if (rounded === 0) return `No change (${change.unit})`;
  return `${change.value < 0 ? "Down" : "Up"} ${rounded} ${change.unit}`;
}

function PreviousRuns() {
  const loadPrograms = useServerFn(getMyPrograms);
  const [result, setResult] = useState<MyProgramsResult | null>(null);
  useEffect(() => {
    let active = true;
    void loadPrograms({ data: {} })
      .then((loaded) => active && setResult(loaded))
      .catch(() => active && setResult({ ok: false }));
    return () => {
      active = false;
    };
  }, [loadPrograms]);

  if (!result)
    return (
      <PlatformPage kicker="Programs" title="Accelerator History">
        <AppLoadingState label="Loading Accelerator history" />
      </PlatformPage>
    );
  const runs = result.ok ? (result.accelerator?.previousRuns ?? []) : [];
  return (
    <PlatformPage
      kicker="Programs"
      title="Accelerator History"
      description="Every completed or replaced 28-day program keeps its original version, dates, and progress."
    >
      <div className="divide-y divide-[var(--pu-border-subtle)] border-y border-[var(--pu-border-strong)]">
        {runs.map((run) => (
          <section key={run.enrollmentId} className="py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">28-Day Accelerator</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {run.completedDays} of 28 days - {run.status}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Version {run.programVersion}</p>
              </div>
              <p className="text-xs text-muted-foreground">{runDate(run.startedAt)}</p>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--pu-border-subtle)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="py-1">
                <dt className="text-xs text-muted-foreground">Starting weight</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {measurementValue(run.measurementSummary.runStarting.weight)}
                </dd>
              </div>
              <div className="py-1">
                <dt className="text-xs text-muted-foreground">Newest weight</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {measurementValue(run.measurementSummary.runNewest.weight)}
                </dd>
                {run.status === "completed" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {changeValue(
                      run.measurementSummary.runStarting.weight,
                      run.measurementSummary.runFinal.weight,
                    )}
                  </p>
                ) : null}
              </div>
              <div className="py-1">
                <dt className="text-xs text-muted-foreground">Starting waist</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {measurementValue(run.measurementSummary.runStarting.waist)}
                </dd>
              </div>
              <div className="py-1">
                <dt className="text-xs text-muted-foreground">Newest waist</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {measurementValue(run.measurementSummary.runNewest.waist)}
                </dd>
                {run.status === "completed" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {changeValue(
                      run.measurementSummary.runStarting.waist,
                      run.measurementSummary.runFinal.waist,
                    )}
                  </p>
                ) : null}
              </div>
            </dl>
          </section>
        ))}
        {!runs.length ? (
          <AppStatePanel
            state="empty"
            title="No Accelerator history yet"
            description="Completed or replaced runs will stay here."
          />
        ) : null}
      </div>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/my-programs">Back to Programs</Link>
      </Button>
    </PlatformPage>
  );
}
