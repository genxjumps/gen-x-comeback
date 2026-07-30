import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { buildPlan, emptyAnswers, readAnswers, type Plan } from "@/lib/plan";


export const Route = createFileRoute("/assessment/complete")({
  head: () => ({
    meta: [
      { title: "Your 7-Day Fitness Plan Is Ready | Gen X Jumps" },
      {
        name: "description",
        content:
          "Preview your personalized 7-day workout schedule and daily protein target, built around your exercise level, jump rope experience, equipment, impact needs, and available training days.",
      },
      { property: "og:title", content: "Your 7-Day Fitness Plan Is Ready | Gen X Jumps" },
      {
        property: "og:description",
        content:
          "A personalized 7-day workout schedule and daily protein target based on your exercise level, jump rope experience, equipment, impact needs, and training days.",
      },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [plan, setPlan] = useState<Plan>(() => buildPlan(emptyAnswers));

  useEffect(() => {
    setPlan(buildPlan(readAnswers()));
  }, []);

  const dayOne = plan.days[0];
  const rest = plan.days.slice(1);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        Your Personalized 7-Day Fitness Plan Is Ready
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Based on your answers, I&rsquo;ve built this plan around your current exercise level, jump
        rope experience, available equipment, whether you need a lower-impact option, and the number
        of days you can consistently train.
      </p>

      {/* Protein */}
      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Your Daily Protein Target
        </h2>
        {plan.protein.grams !== null ? (
          <>
            <p className="mt-1.5 text-lg font-semibold tracking-tight">
              Aim for {plan.protein.grams} grams per day
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Based on the weight you provided, this target is designed to support fat loss,
              preserve muscle, and improve recovery.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-sm font-medium leading-relaxed">
              Aim for about 1 gram of protein per pound of current bodyweight each day. If you use
              kilograms, multiply your weight by 2.2.
            </p>
            <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
              <li>150 lb - about 150 g/day</li>
              <li>180 lb - about 180 g/day</li>
              <li>200 lb - about 200 g/day</li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A simple way to get there is to build three or four meals or eating times around a
              solid protein source. Aim for roughly 30-40 grams each time, then adjust based on your
              bodyweight target.
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed">
              Protein first. Before you build the rest of the meal, decide where the protein is
              coming from.
            </p>
          </>
        )}
      </section>

      {/* How to approach the workouts */}
      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          How to Approach the Workouts
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          These workouts are supposed to challenge you. Work hard. Rest when needed. Do fewer reps
          or use a smaller range of motion when necessary. Skip a movement you cannot perform
          safely. Stop if you feel pain rather than normal exercise discomfort.
        </p>
      </section>

      {/* Days */}
      <section className="mt-8">


        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          <li className="bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">Day 1: {dayOne.title}</h3>
              <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                Today
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {dayOne.description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              About 15 minutes
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-3 w-full sm:w-auto"
              onClick={(e) => e.preventDefault()}
            >
              Start Day 1 Workout
            </Button>
          </li>

          {rest.map((d) => (
            <li key={d.day} className={unlocked ? "bg-card p-4" : "bg-muted/30 p-4"}>
              <h3
                className={
                  unlocked
                    ? "text-sm font-medium"
                    : "text-sm font-medium text-muted-foreground/80"
                }
              >
                Day {d.day}: {d.title}
              </h3>
              {d.description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {d.description}
                </p>
              ) : null}
              {d.minutes ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  About 15 minutes
                </p>
              ) : null}
              {d.optional ? (
                <div className="mt-3 rounded-md border border-dashed border-border p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Optional Active Recovery
                  </p>
                  <p className="mt-1 text-sm font-medium">{d.optional.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {d.optional.description}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    About 15 minutes &middot; optional, not required
                  </p>
                </div>
              ) : null}
            </li>
          ))}

        </ul>
      </section>


      <Separator className="my-8" />

      {/* Unlock */}
      {unlocked ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Your Full 7-Day Workout Plan Is Unlocked
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your complete workout and recovery schedule is now available. Start with Day 1 and
            follow the plan in order.
          </p>
          <Button
            type="button"
            className="mt-4 w-full sm:w-auto"
            onClick={(e) => e.preventDefault()}
          >
            View My Full Plan
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            I&rsquo;ve also emailed you a private link to your plan so you can return to it anytime.
            You can bookmark this page for easy access, too.
          </p>
        </section>
      ) : (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            Unlock Your Full 7-Day Workout Plan
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Enter your first name and email to unlock Days 2-7 and receive a private link to your
            personalized plan.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              You&rsquo;ll Unlock
            </h3>
            <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
              <li>The remaining guided video workouts</li>
              <li>Your complete workout and recovery schedule</li>
              <li>Clear guidance for scaling pace, reps, rest, range of motion, and impact</li>
              <li>A way to return to your plan later</li>
            </ul>
          </div>



          <form
            className="mt-4 grid gap-3 rounded-lg border border-border bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setUnlocked(true);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="first-name">First name</Label>
              <Input id="first-name" name="firstName" autoComplete="given-name" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <Button type="submit" className="mt-1 w-full">
              Unlock My Full 7-Day Workout Plan
            </Button>
            <p className="text-xs text-muted-foreground">
              Free. Get immediate access after submitting.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              By submitting, you agree to receive your plan and occasional fitness emails from Gen
              X Jumps. You can unsubscribe at any time.
            </p>
          </form>
        </section>
      )}

    </div>
  );
}
