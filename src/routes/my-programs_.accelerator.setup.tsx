import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Video } from "lucide-react";
import { z } from "zod";
import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCELERATOR_ORIENTATION } from "@/lib/accelerator/content";
import { beginAccelerator, getMyPrograms } from "@/lib/accelerator/functions";
import type { MeasurementUnit } from "@/lib/accelerator/types";

export const Route = createFileRoute("/my-programs_/accelerator/setup")({
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
  const [currentWeight, setCurrentWeight] = useState<{ value: number; unit: "lb" | "kg" } | null>(
    null,
  );
  const [currentWaist, setCurrentWaist] = useState<{ value: number; unit: "in" | "cm" } | null>(
    null,
  );
  const [measurementChoice, setMeasurementChoice] = useState<
    "undecided" | "current" | "changed" | "skipped"
  >("undecided");

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
      setError("The program couldn’t be started. Reload Programs and try again.");
    } catch {
      setError("The program couldn’t be started. Reload Programs and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlatformPage
      kicker="28-Day Fat Loss Accelerator"
      title="Set Your Starting Point"
      description="Review how the program works, then add starting measurements if you want a clear before-and-after record. Both measurements are optional."
      titleSize="compact"
    >
      <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
        <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
          {ACCELERATOR_ORIENTATION.title}
        </h2>
        <div className="mt-4 flex aspect-video items-center justify-center border-2 border-dashed border-foreground/25 bg-background/60 px-5 text-center">
          <div>
            <Video className="mx-auto size-8 text-foreground/55" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold">Orientation video coming soon</p>
          </div>
        </div>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-foreground/80">
          {ACCELERATOR_ORIENTATION.writtenExplanation.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
        <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
          Starting Measurements
        </h2>
        {repeatRun && (currentWeight || currentWaist) ? (
          <div className="mt-4">
            <p className="text-base font-semibold">
              Use your current measurements as the starting point for your next 28 days?
            </p>
            <p className="mt-1 text-sm text-foreground/65">
              {[
                currentWeight ? `${currentWeight.value} ${currentWeight.unit}` : null,
                currentWaist ? `${currentWaist.value} ${currentWaist.unit} waist` : null,
              ]
                .filter(Boolean)
                .join(" - ")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                size="lg"
                variant={measurementChoice === "current" ? "default" : "outline"}
                className="min-h-14"
                aria-pressed={measurementChoice === "current"}
                onClick={useCurrentMeasurements}
              >
                Use Current Measurements
              </Button>
              <Button
                type="button"
                size="lg"
                variant={measurementChoice === "skipped" ? "default" : "outline"}
                className="min-h-14"
                aria-pressed={measurementChoice === "skipped"}
                onClick={skipCurrentMeasurements}
              >
                Skip Measurements
              </Button>
            </div>
            <p className="mt-3 text-sm text-foreground/65">
              You can change or clear either number below before starting.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-base leading-relaxed text-foreground/80">
            Both are optional. Skip either one or both and start anyway.
          </p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="starting-weight">Weight - {weightUnit}</Label>
            <Input
              id="starting-weight"
              type="number"
              min="1"
              step="0.1"
              value={weight}
              onChange={(event) => {
                setWeight(event.target.value);
                if (repeatRun) setMeasurementChoice("changed");
              }}
              placeholder="Optional"
              className="mt-2 min-h-14"
            />
          </div>
          <div>
            <Label htmlFor="starting-waist">Waist - {waistUnit}</Label>
            <Input
              id="starting-waist"
              type="number"
              min="1"
              step="0.1"
              value={waist}
              onChange={(event) => {
                setWaist(event.target.value);
                if (repeatRun) setMeasurementChoice("changed");
              }}
              placeholder="Optional"
              className="mt-2 min-h-14"
            />
          </div>
        </div>
      </section>

      <div aria-live="polite">
        {error ? (
          <p className="border-l-4 border-gxj-aqua py-2 pl-4 text-base font-medium">{error}</p>
        ) : null}
      </div>
      {willPauseAnother ? (
        <p className="mt-4 border-l-4 border-gxj-aqua py-2 pl-4 text-base leading-relaxed">
          Starting this program will pause your current structured program. Its progress will be
          saved.
        </p>
      ) : null}

      <div className="mt-6 border-t border-foreground/20 pt-5">
        <Button
          type="button"
          size="lg"
          className="gxj-display-title min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto"
          disabled={saving}
          onClick={begin}
        >
          {saving ? "Starting..." : "Begin Day 1"}
        </Button>
      </div>
    </PlatformPage>
  );
}
