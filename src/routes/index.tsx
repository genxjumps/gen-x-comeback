import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Free 7-Day Fitness Comeback Plan for Gen X" },
      {
        name: "description",
        content:
          "A personalized 7-day workout and protein plan for Gen X adults who want to lose fat, rebuild fitness, and get moving again.",
      },
      { property: "og:title", content: "Free 7-Day Fitness Comeback Plan for Gen X" },
      {
        property: "og:description",
        content:
          "Personalized workouts and protein targets for Gen X adults getting back in motion. Start free in 7 days.",
      },
    ],
  }),
  component: Index,
});

const steps = [
  {
    title: "Answer a short assessment",
    body: "A few questions about your body, schedule, and starting point.",
  },
  {
    title: "Get your 7-day plan",
    body: "Daily movement built around what you can realistically do this week.",
  },
  {
    title: "Hit a simple protein target",
    body: "One clear number per day, no calorie spreadsheets.",
  },
];

function Index() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Free 7-day offer
      </p>

      <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Your 7-day fitness comeback starts this week
      </h1>

      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        A personalized workout and protein plan for Gen X adults who want to lose fat, rebuild
        fitness, and get moving again — built around the body and schedule you have right now.
      </p>

      <div className="mt-8">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/assessment">Build My 7-Day Plan</Link>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Free. No equipment assumptions, no account needed to start.
        </p>
      </div>

      <Separator className="my-10" />

      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-muted-foreground">
        How it works
      </h2>

      <div className="mt-4 grid gap-3">
        {steps.map((step, i) => (
          <Card key={step.title} className="border-border/80 shadow-none">
            <CardContent className="flex gap-4 p-5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link to="/assessment">Build My 7-Day Plan</Link>
        </Button>
      </div>
    </div>
  );
}
