import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { title: "Assessment — 7-Day Fitness Comeback Plan" },
      {
        name: "description",
        content:
          "The personalized assessment that builds your 7-day workout and protein plan. Coming soon.",
      },
      { property: "og:title", content: "Assessment — 7-Day Fitness Comeback Plan" },
      {
        property: "og:description",
        content: "The personalized assessment that builds your 7-day plan. Coming soon.",
      },
    ],
  }),
  component: AssessmentPlaceholder,
});

function AssessmentPlaceholder() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start px-5 py-16">
      <h1 className="text-xl font-medium tracking-tight">Assessment coming in checkpoint 2</h1>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Back</Link>
      </Button>
    </div>
  );
}
