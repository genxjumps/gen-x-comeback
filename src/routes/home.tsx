import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Apple, ChartNoAxesColumnIncreasing, Dumbbell } from "lucide-react";

import { homeAssignment } from "@/lib/accelerator/home-snapshot";
import { Button } from "@/components/ui/button";
import { getAcceleratorHub, getMyPrograms } from "@/lib/accelerator/functions";
import { getNutritionProfile } from "@/lib/nutrition/functions";
import type { NutritionProfileResult } from "@/lib/nutrition/types";
import type { AcceleratorHubData, MyProgramsResult } from "@/lib/accelerator/types";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home | Gen X Jumps" },
      {
        name: "description",
        content: "See today’s workout, your programs, progress, and nutrition.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PlatformHome,
});

function PlatformHome() {
  const loadNutrition = useServerFn(getNutritionProfile);
  const [nutrition, setNutrition] = useState<NutritionProfileResult | null>(null);
  const loadPrograms = useServerFn(getMyPrograms);
  const loadAccelerator = useServerFn(getAcceleratorHub);
  const [programs, setPrograms] = useState<MyProgramsResult | null>(null);
  const [acceleratorHub, setAcceleratorHub] = useState<AcceleratorHubData | null>(null);

  useEffect(() => {
    let active = true;
    void loadNutrition({ data: {} }).then(
      (result) => {
        if (active) setNutrition(result);
      },
      () => {
        if (active) setNutrition({ ok: false });
      },
    );
    return () => {
      active = false;
    };
  }, [loadNutrition]);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([loadPrograms({ data: {} }), loadAccelerator({ data: {} })]).then(
      ([programResult, acceleratorResult]) => {
        if (!active) return;
        setPrograms(programResult.status === "fulfilled" ? programResult.value : { ok: false });
        if (acceleratorResult.status === "fulfilled" && acceleratorResult.value.ok) {
          setAcceleratorHub(acceleratorResult.value.data);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [loadAccelerator, loadPrograms]);

  const dailyAssignment = homeAssignment(programs, acceleratorHub);

  const owned = programs?.ok ? programs : null;
  const programCount = owned ? Number(Boolean(owned.accelerator)) + owned.leadPlans.length : 0;
  const measurementLines = owned
    ? (["weight", "waist"] as const).flatMap((kind) => {
        const entry = owned.latestMeasurements[kind];
        if (!entry) return [];
        const label = kind === "weight" ? "Weight" : "Waist";
        return [`${label}: ${entry.value} ${entry.unit}`];
      })
    : [];
  const targets =
    nutrition?.ok && nutrition.access === "eligible" ? nutrition.profile?.targets : null;
  const shortcuts = [
    {
      title: "Programs",
      to: "/my-programs",
      icon: Dumbbell,
      lines: !programs
        ? ["Loading..."]
        : !owned
          ? ["Open to try again"]
          : programCount
            ? [`${programCount} ${programCount === 1 ? "program" : "programs"}`]
            : ["Browse available programs"],
    },
    {
      title: "Progress",
      to: "/progress",
      icon: ChartNoAxesColumnIncreasing,
      lines: !programs
        ? ["Loading..."]
        : !owned
          ? ["Open to try again"]
          : measurementLines.length
            ? measurementLines
            : ["No measurements yet"],
    },
    {
      title: "Nutrition",
      to: "/nutrition",
      icon: Apple,
      lines: !nutrition
        ? ["Loading..."]
        : !nutrition.ok
          ? ["Open to try again"]
          : nutrition.access === "locked"
            ? ["Not unlocked"]
            : targets
              ? [
                  `${targets.calories.toLocaleString()} calories per day`,
                  `${targets.proteinGrams} g protein - ${targets.carbohydrateGrams} g carbs - ${targets.fatGrams} g fat`,
                ]
              : ["Set up your daily targets"],
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header>
        <h1 className="gxj-display-title text-3xl leading-tight tracking-tight sm:text-4xl">
          Today
        </h1>
      </header>

      <section className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
        <div className="p-6 sm:p-8">
          <div>
            {dailyAssignment.label ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
                {dailyAssignment.label}
              </p>
            ) : null}
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{dailyAssignment.title}</h2>
            {dailyAssignment.description ? (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {dailyAssignment.description}
              </p>
            ) : null}
            {programs ? (
              <Button asChild size="lg" className="mt-5 w-full sm:w-auto">
                <Link to={dailyAssignment.to}>
                  {dailyAssignment.button}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="mt-6 grid gap-3 lg:grid-cols-3"
        aria-label="Programs, progress, and nutrition"
      >
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/35 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-4">
                <Icon aria-hidden="true" className="size-5 text-gxj-teal" />
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </div>
              <h2 className="mt-5 text-base font-semibold">{item.title}</h2>
              <div className="mt-3 space-y-2 text-sm leading-relaxed">
                {item.lines.map((line, index) => (
                  <p key={index} className={index === 0 ? "font-medium" : "text-muted-foreground"}>
                    {line}
                  </p>
                ))}
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
