import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";

import { PlatformPage } from "@/components/platform-page";
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
    meta: [
      { title: "Your Progress | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
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
    <div className="rounded-lg border border-border bg-card p-4">
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
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
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
          <p className="mt-1 text-xs capitalize text-muted-foreground">
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
        <div className="mt-3 grid gap-2 rounded-md bg-muted/50 p-3 sm:grid-cols-[1fr_6rem_auto]">
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
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
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

  if (loading) return <p className="text-sm text-muted-foreground">Loading your progress...</p>;
  if (!programs?.ok && !hub)
    return <p className="text-sm text-muted-foreground">Your progress couldn&rsquo;t be loaded.</p>;

  const accelerator = programs?.ok ? programs.accelerator : null;
  const activeLeadPlan = programs?.ok
    ? programs.leadPlans.find((plan) => plan.status === "active")
    : null;
  const currentProgram =
    programs?.ok && programs.activeProgram === "lead_plan" && activeLeadPlan
      ? {
          name: "7-Day Comeback Plan",
          progress: `${activeLeadPlan.completedDays} of ${activeLeadPlan.totalDays} days`,
        }
      : programs?.ok && programs.activeProgram === "other_program"
        ? { name: "Another Gen X Jumps program", progress: "Open My Programs for details" }
        : accelerator?.currentRun
          ? {
              name: "28-Day Fat Loss Accelerator",
              progress: `${accelerator.currentRun.completedDays} of 28 days - ${accelerator.currentRun.status}`,
            }
          : { name: "No active program", progress: "Choose a program when you’re ready" };

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

  return (
    <PlatformPage
      kicker="Your Progress"
      title="See The Work Adding Up"
      description="Your current program and latest optional measurements stay simple here. Open the details only when you want the full history."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Current Program</p>
          <p className="mt-3 text-lg font-semibold">{currentProgram.name}</p>
          <p className="mt-1 text-xs capitalize text-muted-foreground">{currentProgram.progress}</p>
        </section>
        <section className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Latest Weight</p>
          <p className="mt-3 text-lg font-semibold">{formatMeasurement(latest.weight)}</p>
        </section>
        <section className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Latest Waist</p>
          <p className="mt-3 text-lg font-semibold">{formatMeasurement(latest.waist)}</p>
        </section>
      </div>

      {hub ? (
        <section className="mt-5 rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Measurements</h2>
              <p className="mt-1 text-sm text-muted-foreground">
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
              <div className="grid gap-3 sm:grid-cols-2">
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
              {message ? <p className="mt-3 text-sm font-medium">{message}</p> : null}
              <div className="mt-6">
                <h3 className="font-semibold">Full History</h3>
                {hub.measurements.length ? (
                  <ol className="mt-3 divide-y divide-border">
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
                  <p className="mt-3 text-sm text-muted-foreground">
                    No measurements recorded yet.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {accelerator?.previousRuns.length ? (
          <Button asChild variant="outline">
            <Link to="/my-programs/accelerator/runs">View Previous Runs</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link to="/my-programs">My Programs</Link>
        </Button>
      </div>
    </PlatformPage>
  );
}
