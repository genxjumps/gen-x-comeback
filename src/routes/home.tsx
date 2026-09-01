import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Apple, ChartNoAxesColumnIncreasing, Compass, Dumbbell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAcceleratorHub, getMyPrograms } from "@/lib/accelerator/functions";
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

const shortcuts = [
  {
    title: "My Programs",
    description: "See your active, paused, completed, and not-started programs.",
    to: "/my-programs",
    icon: Dumbbell,
  },
  {
    title: "Your Progress",
    description: "See program progress and your latest measurements.",
    to: "/progress",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    title: "Your Nutrition",
    description: "Keep your practical nutrition guidance in one place.",
    to: "/nutrition",
    icon: Apple,
  },
  {
    title: "Explore Programs",
    description: "Find the next structured Gen X Jumps program.",
    to: "/programs",
    icon: Compass,
  },
] as const;

type DailyAssignmentCard = {
  title: string;
  description: string;
  to: "/my-programs" | "/accelerator" | "/your-plan";
  button: string;
  media: string;
};

function friendlyDate(value: string | null): string {
  if (!value) return "the next calendar day";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function PlatformHome() {
  const loadPrograms = useServerFn(getMyPrograms);
  const loadAccelerator = useServerFn(getAcceleratorHub);
  const [programs, setPrograms] = useState<MyProgramsResult | null>(null);
  const [acceleratorHub, setAcceleratorHub] = useState<AcceleratorHubData | null>(null);

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

  let dailyAssignment: DailyAssignmentCard = {
    title: "Choose Your Current Program",
    description: "Start or resume an owned program from My Programs.",
    to: "/my-programs",
    button: "Open My Programs",
    media: "No active assignment",
  };

  if (
    programs?.ok &&
    programs.activeProgram === "accelerator" &&
    acceleratorHub?.progress.currentDay
  ) {
    const day = acceleratorHub.snapshot.days.find(
      ({ day }) => day === acceleratorHub.progress.currentDay,
    );
    if (day) {
      const assignment = acceleratorHub.snapshot.assignments[day.assignment];
      const waiting = !acceleratorHub.progress.canCompleteCurrent;
      dailyAssignment = {
        title: `Day ${day.day}: ${assignment.label}`,
        description: waiting
          ? `You completed today's work. Day ${day.day} opens ${friendlyDate(acceleratorHub.progress.availableOn)}.`
          : `Week ${day.week} of the 28-Day Fat Loss Accelerator. Your place is saved even when life interrupts the schedule.`,
        to: "/accelerator",
        button: waiting ? "View Next Assignment" : "Open Daily Assignment",
        media: day.kind === "rest" ? "Rest-day guidance" : "Current workout video",
      };
    }
  } else if (
    programs?.ok &&
    programs.activeProgram === "accelerator" &&
    acceleratorHub?.progress.programCompleted
  ) {
    dailyAssignment = {
      title: "28-Day Accelerator Complete",
      description: "Your completed run and results remain saved in My Programs and Your Progress.",
      to: "/accelerator",
      button: "Open Completed Program",
      media: "Completed program",
    };
  } else if (programs?.ok && programs.activeProgram === "lead_plan") {
    const plan = programs.leadPlans.find(({ status }) => status === "active");
    if (plan) {
      const nextDay = Math.min(plan.completedDays + 1, plan.totalDays);
      dailyAssignment = {
        title: `Day ${nextDay}: 7-Day Comeback Plan`,
        description: `${plan.completedDays} of ${plan.totalDays} days complete. Continue the same saved plan you already own.`,
        to: "/your-plan",
        button: "Open Daily Assignment",
        media: "Current Comeback Plan assignment",
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header>
        <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">Home</p>
        <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight sm:text-4xl">
          Know What To Do Today
        </h1>
      </header>

      <section className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_16rem] md:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
              Daily Assignment
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {!programs ? "Loading Your Assignment..." : dailyAssignment.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {programs?.ok
                ? dailyAssignment.description
                : programs
                  ? "Your programs couldn't be loaded. Open My Programs to try again."
                  : "Checking your active program and saved progress."}
            </p>
            <Button asChild size="lg" className="mt-5 w-full sm:w-auto">
              <Link to={dailyAssignment.to}>
                {dailyAssignment.button}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/60 px-5 text-center md:aspect-square">
            <p className="text-xs font-medium text-muted-foreground">
              {programs?.ok ? dailyAssignment.media : "Current assignment"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Your fitness platform">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/35 hover:bg-muted/35"
            >
              <div className="flex items-start justify-between gap-4">
                <Icon aria-hidden="true" className="size-5 text-gxj-teal" />
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </div>
              <h2 className="mt-5 text-base font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
