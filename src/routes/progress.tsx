import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";

import { PlatformPage } from "@/components/platform-page";
import {
  AppLinearProgress,
  AppLoadingState,
  AppNotice,
  AppStatePanel,
} from "@/components/precision-surfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addAcceleratorMeasurement,
  correctCustomerMeasurement,
  getAcceleratorHub,
  getMyPrograms,
  removeCustomerMeasurement,
} from "@/lib/accelerator/functions";
import { latestMeasurementPair, measurementSummary } from "@/lib/accelerator/measurements";
import type {
  AcceleratorHubData,
  CustomerMeasurement,
  MeasurementKind,
  MeasurementUnit,
  MyProgramsResult,
} from "@/lib/accelerator/types";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [{ title: "Progress | Gen X Jumps" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Progress,
});

function formatMeasurement(measurement: CustomerMeasurement | null): string {
  return measurement ? `${measurement.value} ${measurement.unit}` : "Not recorded";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function validValue(value: string): number | null {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function unitOptions(kind: MeasurementKind): MeasurementUnit[] {
  return kind === "weight" ? ["lb", "kg"] : ["in", "cm"];
}

function MeasurementForm({
  kind,
  unit,
  saving,
  disabled,
  onSave,
}: {
  kind: MeasurementKind;
  unit: MeasurementUnit;
  saving: boolean;
  disabled: boolean;
  onSave: (value: number, unit: MeasurementUnit) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(unit);
  const label = kind === "weight" ? "Weight" : "Waist";

  async function save() {
    const parsed = validValue(value);
    if (!parsed) return;
    if (await onSave(parsed, selectedUnit)) setValue("");
  }

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <Label htmlFor={`new-${kind}`}>Add {label}</Label>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <Input
          id={`new-${kind}`}
          type="number"
          min="1"
          step="0.1"
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Optional"
        />
        <select
          aria-label={`${label} unit`}
          className="min-h-12 rounded-[var(--pu-radius-control)] border border-[var(--pu-border-strong)] bg-[var(--pu-surface-contained)] px-3 text-base text-[var(--pu-text-primary)]"
          value={selectedUnit}
          disabled={disabled}
          onChange={(event) => setSelectedUnit(event.target.value as MeasurementUnit)}
        >
          {unitOptions(kind).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3"
        disabled={disabled || !validValue(value)}
        onClick={() => void save()}
      >
        <Plus aria-hidden="true" className="size-4" />
        {saving ? "Saving..." : `Add ${label}`}
      </Button>
    </div>
  );
}

function MeasurementHistoryRow({
  measurement,
  disabled,
  onCorrect,
  onRemove,
}: {
  measurement: CustomerMeasurement;
  disabled: boolean;
  onCorrect: (measurement: CustomerMeasurement, value: number, unit: MeasurementUnit) => void;
  onRemove: (measurement: CustomerMeasurement) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(measurement.value));
  const [unit, setUnit] = useState(measurement.unit);
  const parsed = validValue(value);

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold capitalize">
            {measurement.kind} - {formatMeasurement(measurement)}
          </p>
          <p className="mt-1 text-xs capitalize text-[var(--pu-text-secondary)]">
            {formatDate(measurement.measuredAt)} - {measurement.context}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setEditing((current) => !current)}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            Correct
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onRemove(measurement)}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Remove
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="mt-3 grid gap-2 rounded-[var(--pu-radius-contained)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] p-3 sm:grid-cols-[1fr_6rem_auto]">
          <Input
            aria-label={`Correct ${measurement.kind}`}
            type="number"
            min="1"
            step="0.1"
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
          />
          <select
            aria-label={`Correct ${measurement.kind} unit`}
            className="min-h-12 rounded-[var(--pu-radius-control)] border border-[var(--pu-border-strong)] bg-[var(--pu-surface-contained)] px-3 text-base text-[var(--pu-text-primary)]"
            value={unit}
            disabled={disabled}
            onChange={(event) => setUnit(event.target.value as MeasurementUnit)}
          >
            {unitOptions(measurement.kind).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={disabled || !parsed}
            onClick={() => {
              if (!parsed) return;
              onCorrect(measurement, parsed, unit);
              setEditing(false);
            }}
          >
            Save Correction
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function Progress() {
  const loadPrograms = useServerFn(getMyPrograms);
  const loadHub = useServerFn(getAcceleratorHub);
  const addMeasurement = useServerFn(addAcceleratorMeasurement);
  const correctMeasurement = useServerFn(correctCustomerMeasurement);
  const removeMeasurement = useServerFn(removeCustomerMeasurement);
  const [programs, setPrograms] = useState<MyProgramsResult | null>(null);
  const [hub, setHub] = useState<AcceleratorHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([loadPrograms({ data: {} }), loadHub({ data: {} })]).then(
      ([programResult, hubResult]) => {
        if (!active) return;
        if (programResult.status === "fulfilled") setPrograms(programResult.value);
        else setPrograms({ ok: false });
        if (hubResult.status === "fulfilled" && hubResult.value.ok) setHub(hubResult.value.data);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [loadHub, loadPrograms]);

  const summary = useMemo(
    () => (hub ? measurementSummary(hub.measurements, hub.enrollmentId) : null),
    [hub],
  );
  const latest = hub
    ? latestMeasurementPair(hub.measurements)
    : programs?.ok
      ? programs.latestMeasurements
      : { weight: null, waist: null };

  if (loading) {
    return (
      <PlatformPage title="Your Progress" titleSize="compact">
        <AppLoadingState label="Loading your progress" />
      </PlatformPage>
    );
  }

  if (!programs?.ok && !hub) {
    return (
      <PlatformPage title="Your Progress" titleSize="compact">
        <AppStatePanel
          state="error"
          title="Your progress couldn’t be loaded"
          description="Open Progress again to retry."
        />
      </PlatformPage>
    );
  }

  const accelerator = programs?.ok ? programs.accelerator : null;
  const activeLeadPlan = programs?.ok
    ? programs.leadPlans.find((plan) => plan.status === "active")
    : null;
  const currentProgram =
    programs?.ok && programs.activeProgram === "lead_plan" && activeLeadPlan
      ? {
          name: "7-Day Comeback Plan",
          progress: `${activeLeadPlan.completedDays} of ${activeLeadPlan.totalDays} days`,
          completedDays: activeLeadPlan.completedDays,
          totalDays: activeLeadPlan.totalDays,
          accent: "orange" as const,
        }
      : programs?.ok && programs.activeProgram === "other_program"
        ? {
            name: "Another Gen X Jumps program",
            progress: "Open Programs for details",
            completedDays: null,
            totalDays: null,
            accent: "neutral" as const,
          }
        : accelerator?.currentRun
          ? {
              name: "28-Day Fat Loss Accelerator",
              progress: `${accelerator.currentRun.completedDays} of 28 days - ${accelerator.currentRun.status}`,
              completedDays: accelerator.currentRun.completedDays,
              totalDays: 28,
              accent: "aqua" as const,
            }
          : {
              name: "No active program",
              progress: "Choose a program when you’re ready",
              completedDays: null,
              totalDays: null,
              accent: "neutral" as const,
            };
  const currentProgressPercent =
    currentProgram.completedDays !== null && currentProgram.totalDays
      ? Math.round((currentProgram.completedDays / currentProgram.totalDays) * 100)
      : null;

  function replaceMeasurement(saved: CustomerMeasurement) {
    setHub((current) =>
      current
        ? {
            ...current,
            measurements: [saved, ...current.measurements.filter(({ id }) => id !== saved.id)],
          }
        : current,
    );
  }

  async function saveNew(kind: MeasurementKind, value: number, unit: MeasurementUnit) {
    if (!hub) return false;
    setSavingId(`new-${kind}`);
    setMessage(null);
    try {
      const result = await addMeasurement({
        data: {
          enrollmentId: hub.enrollmentId,
          kind,
          value,
          unit,
          context: "progress",
          notes: null,
          measuredAt: new Date().toISOString(),
        },
      });
      if (!result.ok) {
        setMessage("That measurement couldn’t be saved. Reload and try again.");
        return false;
      }
      replaceMeasurement(result.measurement);
      window.dispatchEvent(new CustomEvent("gxj:notifications-changed", { detail: { count: 0 } }));
      setMessage(`${kind === "weight" ? "Weight" : "Waist"} saved.`);
      return true;
    } catch {
      setMessage("That measurement couldn’t be saved. Try again.");
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function correct(entry: CustomerMeasurement, value: number, unit: MeasurementUnit) {
    setSavingId(entry.id);
    setMessage(null);
    try {
      const result = await correctMeasurement({
        data: {
          measurementId: entry.id,
          kind: entry.kind,
          value,
          unit,
          notes: entry.notes,
          measuredAt: entry.measuredAt,
        },
      });
      if (!result.ok) {
        setMessage("That correction couldn’t be saved. Reload and try again.");
        return;
      }
      replaceMeasurement(result.measurement);
      setMessage("Correction saved.");
    } catch {
      setMessage("That correction couldn’t be saved. Try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function remove(entry: CustomerMeasurement) {
    if (!hub) return;
    setSavingId(entry.id);
    setMessage(null);
    try {
      const result = await removeMeasurement({ data: { measurementId: entry.id } });
      if (!result.ok) {
        setMessage("That measurement couldn’t be removed. Reload and try again.");
        return;
      }
      setHub({
        ...hub,
        measurements: hub.measurements.filter(({ id }) => id !== result.measurementId),
      });
      setMessage(`${entry.kind === "weight" ? "Weight" : "Waist"} removed.`);
    } catch {
      setMessage("That measurement couldn’t be removed. Try again.");
    } finally {
      setSavingId(null);
    }
  }

  const messageTone =
    message?.includes("couldn’t") || message?.includes("Try again") ? "danger" : "success";

  return (
    <PlatformPage
      title="Your Progress"
      description="Your current program and latest optional measurements stay simple here. Open the details only when you want the full history."
      titleSize="compact"
    >
      <section className="border-y border-[var(--pu-border-strong)] py-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold leading-tight">Current Program</h2>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]">
              {currentProgram.name}
            </p>
            <p className="mt-1 text-base font-semibold text-[var(--pu-text-primary)]">
              {currentProgram.progress}
            </p>
          </div>
          {currentProgressPercent !== null ? (
            <p className="text-sm font-bold text-[var(--pu-text-secondary)]" aria-hidden="true">
              {currentProgressPercent}% complete
            </p>
          ) : null}
        </div>
        {currentProgressPercent !== null ? (
          <AppLinearProgress
            value={currentProgressPercent}
            label={`${currentProgram.name} progress`}
            accent={currentProgram.accent === "aqua" ? "aqua" : "orange"}
            className="mt-4"
          />
        ) : null}
      </section>

      <section className="border-b border-[var(--pu-border-subtle)] py-6 sm:py-8">
        <h2 className="text-2xl font-extrabold leading-tight">Latest Measurements</h2>
        <dl className="mt-5 grid grid-cols-2 divide-x divide-[var(--pu-border-subtle)]">
          <div className="pr-5">
            <dt className="text-sm text-[var(--pu-text-secondary)]">Latest Weight</dt>
            <dd className="mt-1 text-2xl font-extrabold sm:text-3xl">
              {formatMeasurement(latest.weight)}
            </dd>
          </div>
          <div className="pl-5">
            <dt className="text-sm text-[var(--pu-text-secondary)]">Latest Waist</dt>
            <dd className="mt-1 text-2xl font-extrabold sm:text-3xl">
              {formatMeasurement(latest.waist)}
            </dd>
          </div>
        </dl>
      </section>

      {hub ? (
        <section className="border-b border-[var(--pu-border-subtle)] py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Measurements</h2>
              <p className="mt-1 text-sm text-[var(--pu-text-secondary)]">
                Weight and waist are always independent and optional.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              {detailsOpen ? "Hide Detailed History" : "View Detailed History"}
              <ChevronDown
                aria-hidden="true"
                className={`size-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </div>

          {detailsOpen ? (
            <div className="mt-6">
              <div className="grid divide-y divide-[var(--pu-border-subtle)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <MeasurementForm
                  kind="weight"
                  unit={summary?.globalLatest.weight?.unit ?? "lb"}
                  saving={savingId === "new-weight"}
                  disabled={savingId !== null}
                  onSave={(value, unit) => saveNew("weight", value, unit)}
                />
                <MeasurementForm
                  kind="waist"
                  unit={summary?.globalLatest.waist?.unit ?? "in"}
                  saving={savingId === "new-waist"}
                  disabled={savingId !== null}
                  onSave={(value, unit) => saveNew("waist", value, unit)}
                />
              </div>
              {message ? (
                <AppNotice tone={messageTone} className="mt-4" role="status">
                  {message}
                </AppNotice>
              ) : null}
              <div className="mt-6">
                <h3 className="font-bold">Full History</h3>
                {hub.measurements.length ? (
                  <ol className="mt-3 divide-y divide-[var(--pu-border-subtle)]">
                    {hub.measurements.map((measurement) => (
                      <MeasurementHistoryRow
                        key={measurement.id}
                        measurement={measurement}
                        disabled={savingId !== null}
                        onCorrect={(entry, value, unit) => void correct(entry, value, unit)}
                        onRemove={(entry) => void remove(entry)}
                      />
                    ))}
                  </ol>
                ) : (
                  <AppStatePanel
                    state="empty"
                    title="No measurements recorded yet"
                    description="Weight and waist are optional. Add either one when it becomes useful."
                    className="mt-3"
                  />
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {accelerator?.previousRuns.length ? (
          <Button asChild variant="outline">
            <Link to="/my-programs/accelerator/runs">Accelerator History</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link to="/my-programs">Programs</Link>
        </Button>
      </div>
    </PlatformPage>
  );
}
