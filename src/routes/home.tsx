import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Apple, ChartNoAxesColumnIncreasing, Dumbbell } from "lucide-react";

import { AppList } from "@/components/precision-surfaces";
import { Button } from "@/components/ui/button";
import { homeAssignment } from "@/lib/accelerator/home-snapshot";
import { getAcceleratorHub, getMyPrograms } from "@/lib/accelerator/functions";
import type { AcceleratorHubData, MyProgramsResult } from "@/lib/accelerator/types";
import { getNutritionProfile } from "@/lib/nutrition/functions";
import type { NutritionProfileResult } from "@/lib/nutrition/types";

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
    <div className="mx-auto min-h-full w-full max-w-[var(--pu-content-reading)] pb-10 sm:pb-14">
      <header className="pb-8 pt-6 sm:pb-10 sm:pt-8">
        {dailyAssignment.label ? <p className="gxj-kicker">{dailyAssignment.label}</p> : null}
        <h1 className="mt-3 max-w-2xl text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-[0.96] tracking-[-0.03em] text-[var(--pu-text-primary)]">
          {dailyAssignment.title}
        </h1>
        {dailyAssignment.description ? (
          <p className="mt-3 max-w-xl text-base leading-6 text-[var(--pu-text-secondary)]">
            {dailyAssignment.description}
          </p>
        ) : null}
        {programs ? (
          <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
            <Link to={dailyAssignment.to}>
              {dailyAssignment.button}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        ) : null}
      </header>

      <section aria-label="Programs, progress, and nutrition">
        <AppList>
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group grid min-h-[4.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--pu-border-subtle)] py-4 text-left text-[var(--pu-text-primary)] no-underline focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px]"
              >
                <Icon
                  aria-hidden="true"
                  className="size-5 text-[var(--pu-text-secondary)]"
                  strokeWidth={1.8}
                />
                <div className="min-w-0">
                  <h2 className="text-base font-bold leading-5">{item.title}</h2>
                  <div className="mt-1 space-y-0.5 text-sm leading-5 text-[var(--pu-text-secondary)]">
                    {item.lines.map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="size-5 text-[var(--pu-text-secondary)] transition-transform duration-[120ms] group-hover:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </Link>
            );
          })}
        </AppList>
      </section>
    </div>
  );
}
