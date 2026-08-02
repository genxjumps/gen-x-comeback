import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { readStoredToken } from "@/components/plan-access";
import { verifyAccessToken } from "@/lib/lead.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Free Personalized 7-Day Fitness Plan for Gen X" },
      {
        name: "description",
        content:
          "Get the exact roadmap for where to start, what to do, and how to do it with a personalized workout and protein plan for the next seven days.",
      },
      { property: "og:title", content: "Free Personalized 7-Day Fitness Plan for Gen X" },
      {
        property: "og:description",
        content:
          "Get the exact roadmap for where to start, what to do, and how to do it with a personalized workout and protein plan for the next seven days.",
      },
    ],
  }),
  component: Index,
});

const steps = [
  {
    title: "Clarity changes everything.",
    body: "Answer a few short questions about your current fitness level, schedule, jump rope experience, equipment, and whether you need a lower-impact option.",
  },
  {
    title: "The right plan makes progress simpler.",
    body: "See your complete seven-day schedule, including guided video workouts, recovery days, clear workout-scaling guidance, and a practical protein strategy.",
  },
  {
    title: "Results come from consistency.",
    body: "Start Day 1 with a guided workout that tells you exactly what to do from beginning to end.",
  },
];

function Index() {
  // TEMPORARY TESTING UTILITY: /?reset=1 clears the saved assessment draft
  // (answers and saved step) and strips the query param without reloading.
  // Remove this before production launch.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset") !== "1") return;
      window.localStorage.removeItem("gxj_assessment_draft_v1");
      params.delete("reset");
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", newUrl);
    } catch {
      // ignore
    }
  }, []);

  const verifyToken = useServerFn(verifyAccessToken);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = readStoredToken();
    if (!token) return;
    void (async () => {
      try {
        const result = await verifyToken({ data: { token } });
        if (!cancelled && result.ok) setHasPlan(true);
      } catch {
        // leave default CTA
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verifyToken]);

  const ctaLabel = hasPlan ? "Continue My Plan" : "Build My 7-Day Plan";
  const ctaTo = hasPlan ? "/your-plan" : "/assessment/start";



  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Free personalized 7-day fitness plan
      </p>

      <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Get the exact roadmap for where to start, what to do, and how to do it
      </h1>

      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        No guessing. No complicated program. Just the right workouts, recovery when you need it, and a simple protein plan for your next seven days.
      </p>

      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Get a personalized workout plan built around your current fitness level, jump rope experience, available equipment, the number of days you can consistently train, and whether you need a lower-impact option.
      </p>

      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Training is only half the equation. You'll also get a simple protein plan so you know how much to aim for each day to support fat loss, preserve muscle, and recover without tracking every calorie.
      </p>

      <div className="mt-8">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/assessment/start">Build My 7-Day Plan</Link>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Answer a few short questions. Get your plan and open Day 1 immediately.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Free. No password required to start.
        </p>
      </div>

      <Separator className="my-10" />

      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-muted-foreground">
        How this works
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
          <Link to="/assessment/start">Build My 7-Day Plan</Link>
        </Button>
      </div>
    </div>
  );
}
