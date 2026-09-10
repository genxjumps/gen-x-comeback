import type { AcceleratorHubData, MyProgramsResult } from "./types";

type DailyAssignmentCard = {
  title: string;
  description: string;
  to: "/my-programs" | "/accelerator" | "/your-plan" | "/programs";
  button: string;
  label: string;
};

function friendlyDate(value: string | null): string {
  if (!value) return "the next calendar day";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function homeAssignment(
  programs: MyProgramsResult | null,
  acceleratorHub: AcceleratorHubData | null,
): DailyAssignmentCard {
  let dailyAssignment: DailyAssignmentCard = {
    title: programs ? "Your programs couldn’t be loaded" : "Loading your day...",
    description: programs ? "Open My Programs to try again." : "",
    to: "/my-programs",
    button: "Open My Programs",
    label: "Your Next Step",
  };

  if (programs?.ok) {
    const pausedLead = programs.leadPlans.find((plan) => plan.status === "paused");
    const paused =
      programs.accelerator?.status === "paused"
        ? {
            name: "28-Day Fat Loss Accelerator",
            completed: programs.accelerator.currentRun?.completedDays ?? 0,
            total: 28,
          }
        : pausedLead
          ? {
              name: "7-Day Comeback Plan",
              completed: pausedLead.completedDays,
              total: pausedLead.totalDays,
            }
          : null;
    dailyAssignment = paused
      ? {
          label: "Ready When You Are",
          title: `${paused.name} is paused`,
          description: `${paused.completed} of ${paused.total} days complete. Your progress is saved.`,
          to: "/my-programs",
          button: "Resume a Program",
        }
      : programs.accelerator?.status === "not_started"
        ? {
            label: "Your Next Step",
            title: "Your Accelerator is ready",
            description: "28 days. Start Day 1 when you're ready.",
            to: "/my-programs",
            button: "Start My Program",
          }
        : programs.accelerator || programs.leadPlans.length
          ? {
              label: "Your Next Step",
              title: "Your completed programs are saved",
              description: "Review your results or choose what comes next.",
              to: "/my-programs",
              button: "View My Programs",
            }
          : {
              label: "Your Next Step",
              title: "Find your first program",
              description: "No programs are linked to your account yet.",
              to: "/programs",
              button: "Explore Programs",
            };
    if (programs.activeProgram)
      dailyAssignment = {
        label: "Your Current Program",
        title: "Open your current program",
        description: "Workout details are unavailable here. Open your program to continue.",
        to: "/my-programs",
        button: "Open My Programs",
      };
  }

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
          : `Week ${day.week} · ${acceleratorHub.completedDays.length} of 28 days complete`,
        to: "/accelerator",
        button: waiting ? "View Next Workout" : "Open Today’s Workout",
        label: waiting
          ? "Next Workout"
          : day.kind === "rest"
            ? "Today’s Recovery"
            : "Today’s Workout",
      };
    }
  } else if (
    programs?.ok &&
    programs.activeProgram === "accelerator" &&
    acceleratorHub?.progress.programCompleted
  ) {
    dailyAssignment = {
      title: "28-Day Accelerator Complete",
      description: "Your completed run and results remain saved in My Programs and My Progress.",
      to: "/accelerator",
      button: "Open Completed Program",
      label: "Program Complete",
    };
  } else if (programs?.ok && programs.activeProgram === "lead_plan") {
    const plan = programs.leadPlans.find(({ status }) => status === "active");
    if (plan) {
      const nextDay = Math.min(plan.completedDays + 1, plan.totalDays);
      dailyAssignment = {
        title: `Day ${nextDay}: 7-Day Comeback Plan`,
        description: `${plan.completedDays} of ${plan.totalDays} days complete. Your progress is saved.`,
        to: "/your-plan",
        button: "Open My Plan",
        label: "Your Next Day",
      };
    }
  }

  return dailyAssignment;
}
