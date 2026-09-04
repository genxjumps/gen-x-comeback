import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DayOneWorkout } from "@/components/day-one-workout";
import { DayAssignment } from "@/components/day-assignment";

export const Route = createFileRoute("/your-plan/day/$day")({
  head: ({ params }) => {
    const title =
      params.day === "1"
        ? "Day 1 - Full Body Flush & Fire | Gen X Jumps"
        : `Day ${params.day} Workout | Gen X Jumps`;
    const description =
      params.day === "1"
        ? "Your assigned Day 1 workout: about 15 minutes of short jump rope intervals mixed with sumo squats, push-ups, and seated core work, with a cardio option matched to your saved plan."
        : `Your assigned Day ${params.day} action from your saved 7-day plan, with duration and guidance matched to your saved answers.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: DayRoutePage,
});

function DayRoutePage() {
  const { day } = Route.useParams();
  const navigate = useNavigate();
  const dayNumber = Number(day);
  const valid = Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 7;

  useEffect(() => {
    if (!valid) navigate({ to: "/your-plan", replace: true });
  }, [valid, navigate]);

  if (!valid) return null;
  // Day 1 keeps its dedicated protected page; Days 2-7 share the assignment engine.
  if (dayNumber === 1) return <DayOneWorkout />;
  return <DayAssignment dayNumber={dayNumber} />;
}
