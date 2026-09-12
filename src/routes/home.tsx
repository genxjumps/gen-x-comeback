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
      { name: "description", content: "Your Gen X Jumps program home." },
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
  const activePlan = owned?.leadPlans.find((plan) => plan.status === "active");
  const programRows = owned
    ? [
        ...(owned.accelerator
          ? [
              {
                name: "28-Day Fat Loss Accelerator",
                status: owned.accelerator.status.replace("_", " "),
                progress: `${owned.accelerator.currentRun?.completedDays ?? 0} of 28 days complete`,
              },
            ]
          : []),
        ...owned.leadPlans.map((plan) => ({
          name: "7-Day Comeback Plan",
          status: plan.status,
          progress: `${plan.completedDays} of ${plan.totalDays} days complete`,
        })),
      ]
    : [];
  const targets =
    nutrition?.ok && nutrition.access === "eligible" ? nutrition.profile?.targets : null;
  const shortcuts = [
    {
      title: "Programs",
      to: "/my-programs",
      icon: Dumbbell,
      lines: !programs
        ? ["Loading programs..."]
        : !owned
          ? ["Programs unavailable"]
          : programRows.length
            ? programRows.flatMap((row) => [row.name, `${row.status} · ${row.progress}`])
            : ["No programs yet"],
    },
    {
      title: "Progress",
      to: "/progress",
      icon: ChartNoAxesColumnIncreasing,
      lines: !programs
        ? ["Loading progress..."]
        : !owned
          ? ["Progress unavailable"]
          : [
              ...(owned.activeProgram === "lead_plan" && activePlan
                ? [`${activePlan.completedDays} of ${activePlan.totalDays} days complete`]
                : owned.activeProgram === "accelerator" && owned.accelerator?.currentRun
                  ? [`${owned.accelerator.currentRun.completedDays} of 28 days complete`]
                  : []),
              ...(["weight", "waist"] as const).map((kind) => {
                const entry = owned.latestMeasurements[kind];
                const label = kind === "weight" ? "Weight" : "Waist";
                return entry
                  ? `${label}: ${entry.value} ${entry.unit} · ${new Date(entry.measuredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                  : `${label}: not recorded`;
              }),
            ],
    },
    {
      title: "Nutrition",
      to: "/nutrition",
      icon: Apple,
      lines: !nutrition
        ? ["Loading targets..."]
        : !nutrition.ok
          ? ["Nutrition unavailable"]
          : nutrition.access === "locked"
            ? ["Not unlocked", "Included with an eligible paid program"]
            : targets
              ? [
                  `${targets.calories.toLocaleString()} calories / day`,
                  `${targets.proteinGrams} g protein · ${targets.carbohydrateGrams} g carbs · ${targets.fatGrams} g fat`,
                  "Your saved daily targets",
                ]
              : ["Your targets aren't set yet", "Set up your daily calories and macros"],
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header>
        <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">Home</p>
        <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight sm:text-4xl">
          Know What To Do Today
        </h1>
      </header>

      <section className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
        <div className="p-6 sm:p-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
              {dailyAssignment.label}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{dailyAssignment.title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {dailyAssignment.description}
            </p>
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

      <section className="mt-6 grid gap-3 lg:grid-cols-3" aria-label="Your fitness platform">
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
