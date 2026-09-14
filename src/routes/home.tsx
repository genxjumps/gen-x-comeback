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
      <header className="flex items-end gap-4 border-b-4 border-foreground pb-4">
        <span aria-hidden="true" className="mb-1.5 size-3 shrink-0 bg-gxj-orange" />
        <h1 className="gxj-display-title text-4xl uppercase leading-none tracking-[0.01em] sm:text-5xl">
          Today
        </h1>
      </header>

      <section className="relative mt-6 overflow-hidden border-2 border-foreground bg-gxj-teal text-white shadow-[6px_6px_0_var(--color-foreground)]">
        <div
          aria-hidden="true"
          className="gxj-signal-stripes absolute inset-y-0 right-0 hidden w-40 opacity-25 sm:block"
        />
        <div className="relative p-6 sm:p-9">
          <div className="max-w-2xl">
            {dailyAssignment.label ? (
              <p className="inline-block bg-gxj-orange px-2.5 py-1.5 text-xs font-black uppercase leading-none tracking-[0.13em] text-foreground">
                {dailyAssignment.label}
              </p>
            ) : null}
            <h2 className="gxj-display-title mt-4 text-3xl uppercase leading-tight tracking-[0.01em] sm:text-5xl">
              {dailyAssignment.title}
            </h2>
            {dailyAssignment.description ? (
              <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-white/80">
                {dailyAssignment.description}
              </p>
            ) : null}
            {programs ? (
              <Button
                asChild
                size="lg"
                className="mt-6 min-h-12 w-full rounded-none border-2 border-foreground bg-gxj-orange px-6 text-foreground shadow-[3px_3px_0_var(--color-foreground)] hover:bg-white sm:w-auto"
              >
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
        className="mt-8 grid gap-4 lg:grid-cols-3"
        aria-label="Programs, progress, and nutrition"
      >
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_var(--color-foreground)] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gxj-orange focus-visible:ring-offset-4"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-10 place-items-center bg-gxj-mint text-gxj-teal">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={2.5} />
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-5 text-foreground transition-transform group-hover:translate-x-1"
                />
              </div>
              <h2 className="gxj-display-title mt-5 text-2xl uppercase tracking-[0.02em]">
                {item.title}
              </h2>
              <div className="mt-3 space-y-2 text-base leading-relaxed">
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
