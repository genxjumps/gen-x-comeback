import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/assessment/complete")({
  head: () => ({
    meta: [
      { title: "Your 7-Day Fitness Plan Is Ready | Gen X Jumps" },
      {
        name: "description",
        content:
          "Preview your personalized 7-day workout schedule and daily protein target, built around your fitness level, equipment, and available training days.",
      },
      { property: "og:title", content: "Your 7-Day Fitness Plan Is Ready | Gen X Jumps" },
      {
        property: "og:description",
        content:
          "A personalized 7-day workout schedule and daily protein target based on your assessment answers.",
      },
    ],
  }),
  component: ResultsPage,
});

const days = [
  { day: 2, title: "Recovery and Mobility" },
  { day: 3, title: "Jump Rope and Full-Body Strength" },
  { day: 4, title: "Active Recovery" },
  { day: 5, title: "Full-Body Strength and Cardio" },
  { day: 6, title: "Optional Movement Day" },
  { day: 7, title: "Rest and Reset" },
];

function ResultsPage() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        Your Personalized 7-Day Fitness Plan Is Ready
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Based on your answers, I&rsquo;ve built this plan around your current exercise level, jump
        rope experience, available equipment, movement or impact limits, and the number of days you
        can consistently train.
      </p>

      {/* Protein */}
      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Your Daily Protein Target
        </h2>
        <p className="mt-1.5 text-lg font-semibold tracking-tight">Aim for 145 grams per day</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Based on the weight you provided, this target is designed to support fat loss, preserve
          muscle, and improve recovery.
        </p>
      </section>

      {/* Days */}
      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Your 7-day schedule
        </h2>

        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          <li className="bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">Day 1: Full-Body Comeback Workout</h3>
              <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                Today
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              You&rsquo;ll move through a full-body workout that blends strength, cardio, and
              recovery-friendly pacing so you finish feeling worked, not wrecked.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">24 minutes &middot; Bodyweight</p>
            <Button
              type="button"
              size="sm"
              className="mt-3 w-full sm:w-auto"
              onClick={(e) => e.preventDefault()}
            >
              Start Day 1 Workout
            </Button>
          </li>

          {days.map((d) => (
            <li
              key={d.day}
              className={
                unlocked
                  ? "flex items-center justify-between gap-3 bg-card p-4"
                  : "flex items-center justify-between gap-3 bg-muted/30 p-4"
              }
            >
              <h3
                className={
                  unlocked
                    ? "text-sm font-medium"
                    : "text-sm font-medium text-muted-foreground/80"
                }
              >
                Day {d.day}: {d.title}
              </h3>
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
            full personalized workout plan.
          </p>

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

      <div className="mt-10">
        <Link to="/" className="text-xs text-muted-foreground underline underline-offset-4">
          Back to start
        </Link>
      </div>
    </div>
  );
}
