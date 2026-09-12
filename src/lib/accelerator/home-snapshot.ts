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
    title: programs ? "Find your next workout in Programs" : "Loading...",
    description: "",
    to: "/my-programs",
    button: "Open Programs",
    label: programs ? "Your Next Step" : "",
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
          title: `Resume ${paused.name}`,
          description: `You’ve completed ${paused.completed} of ${paused.total} days.`,
          to: "/my-programs",
          button: "Open Programs",
        }
      : programs.accelerator?.status === "not_started"
        ? {
            label: "Your Next Step",
            title: "Start the 28-Day Fat Loss Accelerator",
            description: "Set it up, then begin Day 1.",
            to: "/my-programs",
            button: "Set Up My Accelerator",
          }
        : programs.accelerator || programs.leadPlans.length
          ? {
              label: "What’s Next",
              title: "Choose what’s next",
              description: "Review a completed program or start another.",
              to: "/my-programs",
              button: "View Programs",
            }
          : {
              label: "Your Next Step",
              title: "Choose your first program",
              description: "",
              to: "/my-programs",
              button: "View Programs",
            };
    if (programs.activeProgram)
      dailyAssignment = {
        label: "Your Current Program",
        title: "Continue your current program",
        description: "",
        to: "/my-programs",
        button: "Open Programs",
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
        title: waiting ? "You’re done for today" : `Day ${day.day}: ${assignment.label}`,
        description: waiting
          ? `Day ${day.day} - ${assignment.label} - opens ${friendlyDate(acceleratorHub.progress.availableOn)}.`
          : `Week ${day.week} - ${acceleratorHub.completedDays.length} of 28 days complete`,
        to: "/accelerator",
        button: waiting
          ? "Preview Next Day"
          : day.kind === "active_recovery"
            ? "Open Today’s Recovery"
            : day.kind === "rest"
              ? "Open Rest Day"
              : "Open Today’s Workout",
        label: waiting
          ? "Today Complete"
          : day.kind === "active_recovery"
            ? "Today’s Recovery"
            : day.kind === "rest"
              ? "Today’s Rest Day"
              : "Today’s Workout",
      };
    }
  } else if (
    programs?.ok &&
    programs.activeProgram === "accelerator" &&
    acceleratorHub?.progress.programCompleted
  ) {
    dailyAssignment = {
      title: "You completed the 28-Day Accelerator",
      description: "See your final progress and choose what’s next.",
      to: "/accelerator",
      button: "View My Results",
      label: "Program Complete",
    };
  } else if (programs?.ok && programs.activeProgram === "lead_plan") {
    const plan = programs.leadPlans.find(({ status }) => status === "active");
    if (plan) {
      const nextDay = Math.min(plan.completedDays + 1, plan.totalDays);
      dailyAssignment = {
        title: `Day ${nextDay}: 7-Day Comeback Plan`,
        description: `${plan.completedDays} of ${plan.totalDays} days complete`,
        to: "/your-plan",
        button: "Open My Plan",
        label: "Your Next Day",
      };
    }
  }

  return dailyAssignment;
}
