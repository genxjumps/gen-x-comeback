import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addAcceleratorMeasurement } from "@/lib/accelerator/functions";
import { measurementChange } from "@/lib/accelerator/measurements";
import type {
  AcceleratorHubData,
  CustomerMeasurement,
  MeasurementKind,
  MeasurementUnit,
} from "@/lib/accelerator/types";

function validValue(value: string): number | null {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatChange(change: ReturnType<typeof measurementChange>): string {
  if (!change) return "Not enough information yet";
  const rounded = Math.round(Math.abs(change.value) * 10) / 10;
  if (rounded === 0) return `No change (${change.unit})`;
  return `${change.value < 0 ? "Down" : "Up"} ${rounded} ${change.unit}`;
}

function FinalMeasurementForm({
  kind,
  defaultUnit,
  saving,
  disabled,
  onSave,
}: {
  kind: MeasurementKind;
  defaultUnit: MeasurementUnit;
  saving: boolean;
  disabled: boolean;
  onSave: (kind: MeasurementKind, value: number, unit: MeasurementUnit) => void;
}) {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(defaultUnit);
  const label = kind === "weight" ? "Final weight" : "Final waist";
  const units: MeasurementUnit[] = kind === "weight" ? ["lb", "kg"] : ["in", "cm"];
  const parsed = validValue(value);

  return (
    <div>
      <Label htmlFor={`final-${kind}`}>{label}</Label>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <Input
          id={`final-${kind}`}
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
          value={unit}
          disabled={disabled}
          onChange={(event) => setUnit(event.target.value as MeasurementUnit)}
        >
          {units.map((option) => (
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
        className="mt-2"
        disabled={disabled || !parsed}
        onClick={() => {
          if (parsed) onSave(kind, parsed, unit);
        }}
      >
        {saving ? "Saving..." : `Save ${label}`}
      </Button>
    </div>
  );
}

export function AcceleratorCompletion({
  hub,
  canUndo,
  savingUndo,
  onUndo,
  onMeasurementSaved,
}: {
  hub: AcceleratorHubData;
  canUndo: boolean;
  savingUndo: boolean;
  onUndo: () => void;
  onMeasurementSaved: (measurement: CustomerMeasurement) => void;
}) {
  const addMeasurement = useServerFn(addAcceleratorMeasurement);
  const [savingKind, setSavingKind] = useState<MeasurementKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { runStarting, runNewest, runFinal } = hub.measurementSummary;
  const finalWeight = runFinal.weight;
  const finalWaist = runFinal.waist;
  const weightChange = measurementChange(runStarting.weight, finalWeight);
  const waistChange = measurementChange(runStarting.waist, finalWaist);

  async function saveFinal(kind: MeasurementKind, value: number, unit: MeasurementUnit) {
    setSavingKind(kind);
    setMessage(null);
    try {
      const result = await addMeasurement({
        data: {
          enrollmentId: hub.enrollmentId,
          kind,
          value,
          unit,
          context: "final",
          notes: null,
          measuredAt: new Date().toISOString(),
        },
      });
      if (!result.ok) {
        setMessage("That final measurement couldn’t be saved. Reload and try again.");
        return;
      }
      onMeasurementSaved(result.measurement);
      setMessage(`${kind === "weight" ? "Final weight" : "Final waist"} saved.`);
    } catch {
      setMessage("That final measurement couldn’t be saved. Try again.");
    } finally {
      setSavingKind(null);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-gxj-mint p-6">
      <div className="flex size-10 items-center justify-center rounded-full bg-gxj-teal text-white">
        <Check aria-hidden="true" className="size-5" />
      </div>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
        Program complete
      </p>
      <h2 className="mt-2 text-2xl font-semibold">You Completed All 28 Days</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        That is the full Accelerator - one day at a time, all the way through.
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-background/80 p-4">
          <dt className="text-xs text-muted-foreground">Final progress</dt>
          <dd className="mt-1 font-semibold">28 of 28 days</dd>
        </div>
        <div className="rounded-md bg-background/80 p-4">
          <dt className="text-xs text-muted-foreground">Weight change</dt>
          <dd className="mt-1 font-semibold">{formatChange(weightChange)}</dd>
        </div>
        <div className="rounded-md bg-background/80 p-4">
          <dt className="text-xs text-muted-foreground">Waist change</dt>
          <dd className="mt-1 font-semibold">{formatChange(waistChange)}</dd>
        </div>
      </dl>

      {!finalWeight || !finalWaist ? (
        <div className="mt-6 rounded-lg border border-border bg-background/80 p-4">
          <h3 className="font-semibold">Optional Final Measurements</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Add either one, both, or skip them. Your program is already complete.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {!finalWeight ? (
              <FinalMeasurementForm
                kind="weight"
                defaultUnit={runNewest.weight?.unit ?? runStarting.weight?.unit ?? "lb"}
                saving={savingKind === "weight"}
                disabled={savingKind !== null}
                onSave={(kind, value, unit) => void saveFinal(kind, value, unit)}
              />
            ) : (
              <p className="text-sm">
                Final weight:{" "}
                <strong>
                  {finalWeight.value} {finalWeight.unit}
                </strong>
              </p>
            )}
            {!finalWaist ? (
              <FinalMeasurementForm
                kind="waist"
                defaultUnit={runNewest.waist?.unit ?? runStarting.waist?.unit ?? "in"}
                saving={savingKind === "waist"}
                disabled={savingKind !== null}
                onSave={(kind, value, unit) => void saveFinal(kind, value, unit)}
              />
            ) : (
              <p className="text-sm">
                Final waist:{" "}
                <strong>
                  {finalWaist.value} {finalWaist.unit}
                </strong>
              </p>
            )}
          </div>
          {message ? <p className="mt-3 text-sm font-medium">{message}</p> : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/my-programs/accelerator/setup" search={{ entitlement: hub.entitlementId }}>
            Start Another Run
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/programs">Explore Other Programs</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/progress">View Your Progress</Link>
        </Button>
        {canUndo ? (
          <Button type="button" variant="outline" disabled={savingUndo} onClick={onUndo}>
            <RotateCcw aria-hidden="true" className="size-4" />
            {savingUndo ? "Reopening..." : "Undo Day 28"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
