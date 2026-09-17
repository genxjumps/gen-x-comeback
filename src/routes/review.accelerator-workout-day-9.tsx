import { createFileRoute } from "@tanstack/react-router";

import { AppReviewScreen } from "@/components/app-review-screen";
import { getReviewScreen } from "@/lib/app-review";

const acceleratorWorkoutReview = getReviewScreen("accelerator-workout-day-9");

if (!acceleratorWorkoutReview) {
  throw new Error("Accelerator workout review screen is missing.");
}

export const Route = createFileRoute("/review/accelerator-workout-day-9")({
  head: () => ({
    meta: [
      { title: "Day 9 - Workout B - EMOM | Gen X Jumps Review" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AcceleratorWorkoutReviewRoute,
});

function AcceleratorWorkoutReviewRoute() {
  return <AppReviewScreen screen={acceleratorWorkoutReview!} />;
}
