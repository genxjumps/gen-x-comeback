import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/assessment/complete")({
  head: () => ({
    meta: [
      { title: "Assessment Complete — Free 7-Day Fitness Plan" },
      {
        name: "description",
        content:
          "Your assessment answers are recorded for this checkpoint. Lead capture and plan details arrive next.",
      },
      { property: "og:title", content: "Assessment Complete — Free 7-Day Fitness Plan" },
      {
        property: "og:description",
        content: "Placeholder completion screen for the assessment shell.",
      },
    ],
  }),
  component: AssessmentComplete,
});

function AssessmentComplete() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Assessment complete</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Lead capture will be added in Checkpoint 3.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Back to start</Link>
      </Button>
    </div>
  );
}
