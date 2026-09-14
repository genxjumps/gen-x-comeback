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
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl pb-10 sm:pb-14">
      <header className="gxj-page-header py-7 sm:py-10">
        <div className="w-full max-w-2xl">
          <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">Gen X Jumps</p>
          <h1 className="gxj-display-title mt-4 text-5xl uppercase leading-[0.95] tracking-wide sm:text-7xl">
            Today
          </h1>
        </div>
      </header>

      <div className="gxj-page-body mx-auto max-w-3xl">
        <section className="gxj-page-section py-6 sm:py-8">
          <div className="max-w-2xl">
            {dailyAssignment.label ? (
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-foreground/60">
                {dailyAssignment.label}
              </p>
            ) : null}
            <h2 className="gxj-display-title mt-3 text-3xl uppercase leading-tight tracking-wide sm:text-4xl">
              {dailyAssignment.title}
            </h2>
            {dailyAssignment.description ? (
              <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/70">
                {dailyAssignment.description}
              </p>
            ) : null}
            {programs ? (
              <Button asChild size="lg" className="mt-6 min-h-12 w-full px-6 sm:w-auto">
                <Link to={dailyAssignment.to}>
                  {dailyAssignment.button}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </section>

        <section
          className="gxj-page-section divide-y divide-foreground/15 py-2"
          aria-label="Programs, progress, and nutrition"
        >
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group grid min-h-24 grid-cols-[auto_1fr_auto] items-center gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gxj-orange focus-visible:ring-offset-2"
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={2.25} />
                <div>
                  <h2 className="gxj-display-title text-2xl uppercase tracking-wide">
                    {item.title}
                  </h2>
                  <div className="mt-1 space-y-1 text-sm leading-relaxed">
                    {item.lines.map((line, index) => (
                      <p
                        key={index}
                        className={index === 0 ? "font-medium" : "text-muted-foreground"}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="size-5 transition-transform group-hover:translate-x-1"
                />
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
