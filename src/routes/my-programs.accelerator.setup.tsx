import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Video } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCELERATOR_ORIENTATION } from "@/lib/accelerator/content";
import { beginAccelerator, getMyPrograms } from "@/lib/accelerator/functions";
import type { MeasurementUnit } from "@/lib/accelerator/types";

export const Route = createFileRoute("/my-programs/accelerator/setup")({
  validateSearch: z.object({ entitlement: z.string().uuid() }),
  head: () => ({
    meta: [
      { title: "Start Accelerator | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AcceleratorSetup,
});

function positiveNumber(value: string): number | null {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function AcceleratorSetup() {
  const { entitlement } = Route.useSearch();
  const startProgram = useServerFn(beginAccelerator);
  const loadPrograms = useServerFn(getMyPrograms);
  const navigate = useNavigate();
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [weightUnit, setWeightUnit] = useState<Extract<MeasurementUnit, "lb" | "kg">>("lb");
  const [waistUnit, setWaistUnit] = useState<Extract<MeasurementUnit, "in" | "cm">>("in");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [willPauseAnother, setWillPauseAnother] = useState(false);
  const [repeatRun, setRepeatRun] = useState(false);
  const [currentWeight, setCurrentWeight] = useState<{ value: number; unit: "lb" | "kg" } | null>(null);
  const [currentWaist, setCurrentWaist] = useState<{ value: number; unit: "in" | "cm" } | null>(null);
  const [measurementChoice, setMeasurementChoice] = useState<"undecided" | "current" | "changed" | "skipped">("undecided");

  useEffect(() => {
    let active = true;
    void loadPrograms({ data: {} }).then((programs) => {
      if (!active || !programs.ok) return;
      setWillPauseAnother(programs.activeProgram !== null);
      setRepeatRun(programs.accelerator?.status === "completed");
      const latestWeight = programs.latestMeasurements.weight;
      const latestWaist = programs.latestMeasurements.waist;
      if (latestWeight && (latestWeight.unit === "lb" || latestWeight.unit === "kg")) {
        setCurrentWeight({ value: latestWeight.value, unit: latestWeight.unit });
        setWeightUnit(latestWeight.unit);
      }
      if (latestWaist && (latestWaist.unit === "in" || latestWaist.unit === "cm")) {
        setCurrentWaist({ value: latestWaist.value, unit: latestWaist.unit });
        setWaistUnit(latestWaist.unit);
      }
    });
    return () => {
      active = false;
    };
  }, [loadPrograms]);

  function useCurrentMeasurements() {
    setWeight(currentWeight ? String(currentWeight.value) : "");
    setWaist(currentWaist ? String(currentWaist.value) : "");
    if (currentWeight) setWeightUnit(currentWeight.unit);
    if (currentWaist) setWaistUnit(currentWaist.unit);
    setMeasurementChoice("current");
  }

  function skipCurrentMeasurements() {
    setWeight("");
    setWaist("");
    setMeasurementChoice("skipped");
  }

  async function begin() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const weightValue = positiveNumber(weight);
    const waistValue = positiveNumber(waist);
    try {
      const result = await startProgram({
        data: {
          entitlementId: entitlement,
          customerTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          weight: weightValue ? { value: weightValue, unit: weightUnit } : null,
          waist: waistValue ? { value: waistValue, unit: waistUnit } : null,
        },
      });
      if (result.ok) {
        await navigate({ to: "/accelerator" });
        return;
      }
      setError("The program couldn’t be started. Reload My Programs and try again.");
    } catch {
      setError("The program couldn’t be started. Reload My Programs and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">Program Setup</p>
      <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight sm:text-4xl">Start Your 28-Day Accelerator</h1>
      <section className="mt-8 rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{ACCELERATOR_ORIENTATION.title}</h2>
        <div className="mt-4 flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/60 px-5 text-center">
          <div>
            <Video className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Orientation video pending recording</p>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          {ACCELERATOR_ORIENTATION.writtenExplanation.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
      <section className="mt-4 rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Starting Measurements</h2>
        {repeatRun && (currentWeight || currentWaist) ? (
          <div className="mt-3 rounded-md border border-border bg-muted/50 p-4">
            <p className="text-sm font-semibold">Use your current measurements as the starting point for this run?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[currentWeight ? `${currentWeight.value} ${currentWeight.unit}` : null, currentWaist ? `${currentWaist.value} ${currentWaist.unit} waist` : null].filter(Boolean).join(" - ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={measurementChoice === "current" ? "default" : "outline"} aria-pressed={measurementChoice === "current"} onClick={useCurrentMeasurements}>Use Current Measurements</Button>
              <Button type="button" size="sm" variant={measurementChoice === "skipped" ? "default" : "outline"} aria-pressed={measurementChoice === "skipped"} onClick={skipCurrentMeasurements}>Skip Measurements</Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">You can change or clear either number below before starting.</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Both are optional. Skip either one or both and start anyway.</p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="starting-weight">Weight - {weightUnit}</Label>
            <Input id="starting-weight" type="number" min="1" step="0.1" value={weight} onChange={(event) => { setWeight(event.target.value); if (repeatRun) setMeasurementChoice("changed"); }} placeholder="Optional" className="mt-2" />
          </div>
          <div>
            <Label htmlFor="starting-waist">Waist - {waistUnit}</Label>
            <Input id="starting-waist" type="number" min="1" step="0.1" value={waist} onChange={(event) => { setWaist(event.target.value); if (repeatRun) setMeasurementChoice("changed"); }} placeholder="Optional" className="mt-2" />
          </div>
        </div>
      </section>
      {error ? <p className="mt-4 text-sm font-medium">{error}</p> : null}
      {willPauseAnother ? (
        <p className="mt-4 rounded-md border border-border bg-muted/50 p-4 text-sm leading-relaxed">Starting this program will pause your current structured program. Its progress will be saved.</p>
      ) : null}
      <Button type="button" size="lg" className="mt-6 w-full" disabled={saving} onClick={begin}>{saving ? "Starting..." : "Begin Day 1"}</Button>
    </div>
  );
}
