import {
  ArrowRight,
  Apple,
  Check,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Dumbbell,
  Mail,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";

import { PlatformPage } from "@/components/platform-page";
import { ReviewShell } from "@/components/review-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkoutMediaCard } from "@/components/workout-media-card";
import type { ReviewScreen } from "@/lib/app-review";

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-t border-foreground/15 py-6 first:border-t-0 first:pt-0 sm:py-8">
      {title ? (
        <h2 className="gxj-display-title mb-4 text-2xl uppercase tracking-wide sm:text-3xl">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex min-h-8 items-center rounded-[2px] bg-foreground px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-background">
      {children}
    </p>
  );
}

function Action({ children, outline = false }: { children: ReactNode; outline?: boolean }) {
  return (
    <Button
      type="button"
      variant={outline ? "outline" : "default"}
      size="lg"
      className="min-h-12 w-full sm:w-auto"
    >
      {children}
    </Button>
  );
}

function Choice({ children, selected = false }: { children: ReactNode; selected?: boolean }) {
  return (
    <div
      className={`flex min-h-14 items-center rounded-md border px-4 py-3 font-semibold ${
        selected ? "border-gxj-orange bg-gxj-mint" : "border-foreground/20 bg-background"
      }`}
    >
      <span
        className={`mr-3 size-4 rounded-full border ${selected ? "border-[5px] border-gxj-orange" : "border-foreground/40"}`}
      />
      {children}
    </div>
  );
}

function Page({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PlatformPage kicker={kicker} title={title} description={description}>
      {children}
    </PlatformPage>
  );
}

function HomeReview({ variant }: { variant: string }) {
  const daily =
    variant === "accelerator"
      ? {
          kicker: "Day 9 of 28",
          title: "Upper Body B",
          description: "Your strength workout is ready.",
          button: "Open Today's Workout",
        }
      : variant === "empty"
        ? {
            kicker: "Your Next Step",
            title: "Choose What Comes Next",
            description: "Your programs and progress are saved here.",
            button: "Open My Programs",
          }
        : variant === "loading"
          ? {
              kicker: "Your Next Step",
              title: "Loading Today's Workout",
              description: "We're getting your plan ready.",
              button: "",
            }
          : variant === "error"
            ? {
                kicker: "Your Next Step",
                title: "Your Programs Couldn't Be Loaded",
                description: "Open My Programs to try again.",
                button: "Open My Programs",
              }
            : {
                kicker: "Day 3 of 7",
                title: "Jump + Strength",
                description: "Your next workout is ready.",
                button: "Open Day 3",
              };
  const summary =
    variant === "loading"
      ? ["Loading...", "Loading...", "Loading..."]
      : variant === "error"
        ? ["Open to try again", "Open to try again", "Not unlocked"]
        : variant === "empty"
          ? ["1 program", "No measurements yet", "Set up your daily targets"]
          : ["2 programs", "Weight: 175 lb", "2,100 calories per day"];
  const rows = [
    { title: "Programs", line: summary[0], icon: Dumbbell, href: "/review/programs-active" },
    {
      title: "Progress",
      line: summary[1],
      icon: ChartNoAxesColumnIncreasing,
      href: "/review/progress-active",
    },
    { title: "Nutrition", line: summary[2], icon: Apple, href: "/review/nutrition-active" },
  ];

  if (variant === "seven-day") {
    return (
      <div className="mx-auto min-h-full w-full max-w-5xl pb-10 pt-4 sm:pb-14 sm:pt-6">
        <div className="mx-auto max-w-3xl">
          <p className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
            Today&rsquo;s Workout
          </p>
          <a
            href="/review/workout-day-3-ready"
            aria-label="Open today's Day 3 workout - Jump and Strength"
            className="group mt-4 block overflow-hidden rounded-md border border-foreground/70 bg-foreground text-background shadow-[3px_3px_0_color-mix(in_oklch,var(--color-foreground)_14%,transparent)] transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gxj-orange focus-visible:ring-offset-4"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] sm:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="flex min-h-32 flex-col justify-center px-5 py-5 sm:min-h-40 sm:px-7 sm:py-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-background/65 sm:text-sm">
                  Day 3 of 7
                </p>
                <h1 className="gxj-display-title mt-2 text-3xl uppercase leading-[0.96] tracking-wide sm:text-4xl">
                  Jump + Strength
                </h1>
                <p className="mt-2 text-xs font-semibold text-background/75 sm:text-sm">
                  15 minutes · Jump rope + body weight
                </p>
              </div>
              <div className="overflow-hidden bg-background">
                <img
                  src="/workout-covers/day-03.webp"
                  alt=""
                  className="h-full w-full object-cover object-[70%_center] transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
            </div>
            <div className="flex min-h-16 items-center justify-between gap-5 bg-gxj-orange px-5 py-3 text-white sm:px-7">
              <span className="gxj-display-title text-2xl uppercase leading-none sm:text-3xl">
                Open Today&rsquo;s Workout
              </span>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-gxj-orange transition-transform group-hover:translate-x-1">
                <ArrowRight aria-hidden="true" className="size-4" />
              </span>
            </div>
          </a>
        </div>

        <section className="mx-auto mt-5 max-w-3xl" aria-labelledby="fitness-hub">
          <h2
            id="fitness-hub"
            className="gxj-display-title text-xl uppercase tracking-wide sm:text-2xl"
          >
            Your Gen X Jumps Fitness Hub
          </h2>
          <div className="mt-3 divide-y divide-foreground/15 border-t-2 border-foreground">
            {rows.map(({ title, line, icon: Icon, href }) => (
              <a
                href={href}
                aria-label={`Open ${title}`}
                key={title}
                className="group -mx-3 grid min-h-24 grid-cols-[auto_1fr_auto] items-center gap-4 px-3 py-5 transition-colors hover:bg-foreground/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gxj-orange focus-visible:ring-offset-2"
              >
                <Icon className="size-5" aria-hidden="true" />
                <div>
                  <h3 className="gxj-display-title text-2xl uppercase tracking-wide">{title}</h3>
                  <p className="mt-1 text-sm font-medium">{line}</p>
                </div>
                <ArrowRight
                  className="size-5 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full w-full max-w-5xl pb-10 sm:pb-14">
      <header className="pb-6 pt-4 sm:pb-8 sm:pt-6">
        <div className="max-w-2xl">
          <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">{daily.kicker}</p>
          <h1 className="gxj-display-title mt-4 text-5xl uppercase leading-[0.95] tracking-wide sm:text-7xl">
            {daily.title}
          </h1>
          <p className="mt-3 max-w-lg text-base font-medium leading-relaxed text-foreground/80 sm:text-lg">
            {daily.description}
          </p>
          {daily.button ? (
            <div className="mt-6">
              <Action>
                {daily.button}
                <ArrowRight className="size-4" />
              </Action>
            </div>
          ) : null}
        </div>
      </header>
      <div className="mx-auto max-w-3xl divide-y divide-foreground/15 py-2">
        {rows.map(({ title, line, icon: Icon }) => (
          <div
            key={title}
            className="grid min-h-24 grid-cols-[auto_1fr_auto] items-center gap-4 py-5"
          >
            <Icon className="size-5" aria-hidden="true" />
            <div>
              <h2 className="gxj-display-title text-2xl uppercase tracking-wide">{title}</h2>
              <p className="mt-1 text-sm font-medium">{line}</p>
            </div>
            <ArrowRight className="size-5" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingReview() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <Status>Free 7-Day Plan</Status>
      <h1 className="gxj-display-title mt-5 text-5xl uppercase leading-[0.94] tracking-wide sm:text-7xl">
        Prove You're Not Done Yet
      </h1>
      <p className="mt-5 max-w-xl text-lg font-medium leading-relaxed">
        Get a simple jump rope, strength, and nutrition plan built around what you can do right now.
      </p>
      <div className="mt-8">
        <Action>
          Build My 7-Day Plan <ArrowRight className="size-4" />
        </Action>
      </div>
      <Section title="Built for a real comeback">
        <div className="grid gap-5 sm:grid-cols-3">
          {["Short workouts", "Simple food targets", "Options for your joints"].map((item) => (
            <p key={item} className="border-t-2 border-foreground pt-3 font-bold">
              {item}
            </p>
          ))}
        </div>
      </Section>
    </div>
  );
}

function EligibilityReview() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <Status>Before You Start</Status>
      <h1 className="gxj-display-title mt-4 text-5xl uppercase leading-none sm:text-6xl">
        Make Sure This Plan Fits
      </h1>
      <p className="mt-4 text-lg leading-relaxed">
        This plan is for adults who can exercise safely on their own and want a practical place to
        restart.
      </p>
      <Section title="This plan may work for you if">
        <ul className="space-y-3 font-medium">
          {[
            "You can walk without help",
            "You can get up from a chair",
            "You can adjust or stop when something hurts",
          ].map((x) => (
            <li key={x} className="flex gap-3">
              <Check className="mt-0.5 size-5 shrink-0" />
              {x}
            </li>
          ))}
        </ul>
      </Section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Action>Continue</Action>
        <Action outline>This Isn't Right for Me</Action>
      </div>
    </div>
  );
}

function AssessmentReview({ step }: { step: string }) {
  const content =
    step === "1"
      ? {
          title: "Start Where You Are",
          description: "Tell us what feels realistic today.",
          question: "How active are you right now?",
          choices: ["Mostly sitting", "Some walking", "Regular exercise"],
        }
      : step === "2"
        ? {
            title: "Protect Your Joints",
            description: "Choose the impact level that fits your body.",
            question: "What kind of jumping feels right?",
            choices: ["No jumping yet", "Low-impact bouncing", "Regular jump rope"],
          }
        : {
            title: "Set Your Starting Point",
            description: "These numbers help personalize your food targets.",
            question: "Add your current measurements",
            choices: [],
          };
  return (
    <div className="gxj-page mx-auto w-full max-w-2xl px-5 py-7 sm:py-10">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full bg-gxj-orange" style={{ width: `${Number(step) * 33.333}%` }} />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em]">Step {step} of 3</p>
      <h1 className="gxj-display-title mt-3 text-5xl uppercase leading-none sm:text-6xl">
        {content.title}
      </h1>
      <p className="mt-3 text-lg text-foreground/75">{content.description}</p>
      <Section title={content.question}>
        {step === "3" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="font-bold">
              Current weight <Input className="mt-2 min-h-12" value="175" readOnly />
            </label>
            <label className="font-bold">
              Waist <span className="font-normal text-muted-foreground">(optional)</span>
              <Input className="mt-2 min-h-12" value="34" readOnly />
            </label>
          </div>
        ) : (
          <div className="grid gap-3">
            {content.choices.map((choice, index) => (
              <Choice key={choice} selected={step === "2" && index === 1}>
                {choice}
              </Choice>
            ))}
          </div>
        )}
      </Section>
      <div className="flex flex-col-reverse gap-3 border-t border-foreground/15 pt-6 sm:flex-row sm:justify-between">
        <Action outline>Back</Action>
        <Action>{step === "3" ? "See My Plan" : "Continue"}</Action>
      </div>
    </div>
  );
}

function AssessmentResultReview({ replace }: { replace: boolean }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <Status>{replace ? "Plan Update" : "Your Plan Is Ready"}</Status>
      <h1 className="gxj-display-title mt-4 text-5xl uppercase leading-none sm:text-6xl">
        {replace ? "Review Your New Starting Point" : "Your 7-Day Comeback Starts Here"}
      </h1>
      <p className="mt-4 text-lg leading-relaxed">
        Four short jump rope and strength days, two easier movement days, and one full recovery day.
      </p>
      <Section title="Your plan at a glance">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <strong className="gxj-display-title text-4xl">7</strong>
            <p className="text-sm">days</p>
          </div>
          <div>
            <strong className="gxj-display-title text-4xl">4</strong>
            <p className="text-sm">workouts</p>
          </div>
          <div>
            <strong className="gxj-display-title text-4xl">15</strong>
            <p className="text-sm">minutes</p>
          </div>
        </div>
      </Section>
      {replace ? (
        <div className="mb-6 border-l-4 border-gxj-orange pl-4">
          <p className="font-bold">Replacing this plan clears its current progress.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your paid programs and completed program history stay in your account.
          </p>
        </div>
      ) : null}
      <Action>{replace ? "Replace My 7-Day Plan" : "Save My Plan"}</Action>
    </div>
  );
}

function WelcomeReview({ returning }: { returning: boolean }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12 text-center sm:py-20">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-foreground text-background">
        <Mail className="size-6" />
      </span>
      <h1 className="gxj-display-title mt-6 text-5xl uppercase leading-none sm:text-6xl">
        {returning ? "Welcome Back" : "Check Your Email"}
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed">
        {returning
          ? "We found an existing Gen X Jumps account. Use the secure link we sent to get back in."
          : "Your secure access link is on its way. Open it on the device where you want to use your plan."}
      </p>
      <div className="mt-7">
        <Action>{returning ? "Send Another Link" : "Open My Email"}</Action>
      </div>
    </div>
  );
}

function PlanReadyReview() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <Status>Plan Saved</Status>
      <h1 className="gxj-display-title mt-4 text-5xl uppercase leading-none sm:text-6xl">
        Keep Your Plan One Tap Away
      </h1>
      <p className="mt-4 text-lg leading-relaxed">
        Add Gen X Jumps to your Home Screen so it's easy to open when you're ready to work out.
      </p>
      <Section title="On iPhone or iPad">
        <ol className="space-y-4">
          {["Tap the Share button", "Choose Add to Home Screen", "Tap Add"].map((x, i) => (
            <li className="flex gap-3" key={x}>
              <span className="gxj-display-title text-2xl">0{i + 1}</span>
              <span className="pt-1 font-semibold">{x}</span>
            </li>
          ))}
        </ol>
      </Section>
      <div className="grid gap-3">
        <Action>Add to Home Screen</Action>
        <Action outline>Not Now - View My Plan</Action>
      </div>
    </div>
  );
}

function PlanReview({ complete }: { complete: boolean }) {
  return (
    <Page
      kicker={complete ? "Plan Complete" : "Your 7-Day Plan"}
      title={complete ? "You Finished the Week" : "Your Comeback Week"}
      description={
        complete
          ? "Every day stays here whenever you want to review it."
          : "Today is Day 3. Keep the next step simple and finish what is in front of you."
      }
    >
      <Section title="Schedule">
        <div className="divide-y divide-foreground/15">
          {[
            "Jump + Strength",
            "Easy Movement",
            "Jump + Strength",
            "Recovery",
            "Jump + Strength",
            "Easy Movement",
            "Full Rest",
          ].map((x, i) => (
            <div key={`${x}-${i}`} className="flex min-h-16 items-center gap-4 py-3">
              <span
                className={`grid size-8 place-items-center rounded-full ${complete || i < 2 ? "bg-foreground text-background" : i === 2 ? "bg-gxj-orange text-white" : "border border-foreground/25"}`}
              >
                {complete || i < 2 ? <Check className="size-4" /> : i + 1}
              </span>
              <div className="flex-1">
                <p className="font-bold">Day {i + 1}</p>
                <p className="text-sm text-muted-foreground">{x}</p>
              </div>
              <ChevronRight className="size-5" />
            </div>
          ))}
        </div>
      </Section>
      <div className="flex flex-wrap gap-3">
        <Action>{complete ? "Start Again" : "Open Today's Workout"}</Action>
        <Action outline>Change My Answers</Action>
      </div>
    </Page>
  );
}

function WorkoutReview({ variant }: { variant: string }) {
  const recovery = variant === "recovery";
  const day = recovery
    ? 7
    : variant === "blocked"
      ? 3
      : variant === "ready-day-3"
        ? 3
        : variant === "scheduled"
          ? 4
          : variant === "completed"
            ? 2
            : 1;
  return (
    <Page
      kicker={`Day ${day} of 7`}
      title={recovery ? "Full Rest" : day === 2 ? "Easy Movement" : "Jump + Strength"}
      description={
        recovery
          ? "Recovery is part of the plan. Take the day off and let your body absorb the work."
          : "About 15 minutes. Use the easier option any time you need it."
      }
    >
      <Section title="Before You Start">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Time</p>
            <p className="mt-1 font-bold">About 15 minutes</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Equipment
            </p>
            <p className="mt-1 font-bold">Rope and mat</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Effort
            </p>
            <p className="mt-1 font-bold">Steady</p>
          </div>
        </div>
      </Section>
      {recovery ? (
        <div className="border-y border-foreground/15 py-8">
          <h2 className="gxj-display-title text-3xl uppercase">Today's Work Is Rest</h2>
          <p className="mt-3 max-w-xl leading-relaxed">
            An easy walk is fine if it helps you feel better. You don't need to make up a missed
            workout today.
          </p>
          <div className="mt-6">
            <Action>Mark Day Complete</Action>
          </div>
        </div>
      ) : (
        <WorkoutMediaCard
          dayNumber={day}
          code={`w0${day}`}
          title={day === 2 ? "Easy Movement" : "Jump + Strength"}
          state={
            variant === "blocked"
              ? { type: "blocked", previousDay: 2, availableLabel: "Wednesday" }
              : variant === "scheduled"
                ? { type: "scheduled", availableLabel: "Thursday" }
                : variant === "completed"
                  ? { type: "completed" }
                  : { type: "ready" }
          }
        />
      )}
      {!recovery ? (
        <Section title="Workout Approach">
          <p className="leading-relaxed">
            Move at a pace you can control. Take more rest when you need it. Stop if you feel sharp
            pain, dizziness, or anything that doesn't feel right.
          </p>
        </Section>
      ) : null}
    </Page>
  );
}

function JumpRopesReview() {
  return (
    <Page
      kicker="Equipment Guide"
      title="Choose a Jump Rope"
      description="You don't need an expensive rope. You need one that fits and turns smoothly."
    >
      <Section title="Start with the fit">
        <p className="leading-relaxed">
          Stand on the middle of the rope. The handle ends should reach around your armpits. A
          little longer is easier while you're learning.
        </p>
      </Section>
      <Section title="Good beginner choices">
        <div className="divide-y divide-foreground/15">
          {[
            "PVC rope - light and affordable",
            "Beaded rope - easier to feel",
            "Weighted rope - slower feedback",
          ].map((x) => (
            <p key={x} className="py-4 font-semibold">
              {x}
            </p>
          ))}
        </div>
      </Section>
    </Page>
  );
}

function ProgramsReview({ variant }: { variant: string }) {
  const error = variant === "error";
  const entries =
    variant === "empty"
      ? [
          {
            status: "AVAILABLE",
            title: "28-Day Fat Loss Accelerator",
            detail: "Ready when you want more structure",
            action: "Explore the Accelerator",
          },
        ]
      : [
          {
            status:
              variant === "active"
                ? "ACTIVE - DAY 9"
                : variant === "paused"
                  ? "PAUSED"
                  : variant === "complete"
                    ? "COMPLETED"
                    : "NOT STARTED",
            title: "28-Day Fat Loss Accelerator",
            detail:
              variant === "not-started"
                ? "Owned for life. Start when you're ready."
                : variant === "paused"
                  ? "Your progress is saved."
                  : variant === "complete"
                    ? "Completed August 28, 2026"
                    : "Your next workout is ready.",
            action:
              variant === "not-started"
                ? "Set Up My Accelerator"
                : variant === "paused"
                  ? "Resume Program"
                  : variant === "complete"
                    ? "View Program History"
                    : "Open Today's Workout",
          },
          {
            status: variant === "complete" ? "COMPLETED" : "ACTIVE",
            title: "7-Day Comeback Plan",
            detail: variant === "complete" ? "Completed September 7, 2026" : "Day 3 of 7",
            action: "Open My Plan",
          },
        ];
  return (
    <Page
      kicker="My Programs"
      title={error ? "Your Programs Couldn't Be Loaded" : "Your Programs, In One Place"}
      description={
        error
          ? "Try again without leaving the app."
          : "Programs you own stay here - not started, active, paused, and completed."
      }
    >
      {error ? (
        <div className="py-4">
          <Action>Try Again</Action>
        </div>
      ) : (
        <div className="divide-y divide-foreground/15">
          {entries.map((entry) => (
            <section className="py-7 first:pt-0" key={entry.title}>
              <Status>{entry.status}</Status>
              <h2 className="gxj-display-title mt-4 text-3xl uppercase tracking-wide">
                {entry.title}
              </h2>
              <p className="mt-2 text-muted-foreground">{entry.detail}</p>
              <div className="mt-5">
                <Action>
                  {entry.action}
                  <ArrowRight className="size-4" />
                </Action>
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

function OfferReview() {
  return (
    <Page
      kicker="Your Next Program"
      title="28-Day Fat Loss Accelerator"
      description="Four weeks of jump rope, dumbbell strength, simple nutrition targets, and visible progress."
    >
      <Section title="What You Get">
        <ul className="space-y-3">
          {[
            "A clear workout for every program day",
            "Jump rope and dumbbell options",
            "Personal calorie and protein targets",
            "Progress and measurement tracking",
            "Lifetime access to the program",
          ].map((x) => (
            <li key={x} className="flex gap-3 font-medium">
              <Check className="size-5 shrink-0" />
              {x}
            </li>
          ))}
        </ul>
      </Section>
      <Section>
        <p className="gxj-display-title text-5xl">$47</p>
        <p className="mt-1 text-sm text-muted-foreground">One payment. No subscription.</p>
        <div className="mt-6">
          <Action>Get the 28-Day Accelerator</Action>
        </div>
      </Section>
    </Page>
  );
}

function CheckoutReview({ pending }: { pending: boolean }) {
  return (
    <Page
      kicker={pending ? "Purchase Received" : "You Own It"}
      title={pending ? "Finishing Your Purchase" : "Your Accelerator Is Ready"}
      description={
        pending
          ? "Payment went through. We're connecting the program to your account."
          : "The 28-Day Fat Loss Accelerator now lives in My Programs."
      }
    >
      <Section>
        <div className="flex gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background">
            {pending ? <RotateCcw className="size-5" /> : <Check className="size-5" />}
          </span>
          <div>
            <p className="font-bold">
              {pending ? "This usually takes only a moment" : "No email check needed"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {pending
                ? "You can safely refresh this page."
                : "Set up your program now or come back through My Programs."}
            </p>
          </div>
        </div>
      </Section>
      <Action>{pending ? "Check Again" : "Set Up My Accelerator"}</Action>
    </Page>
  );
}

function AcceleratorSetupReview() {
  return (
    <Page
      kicker="28-Day Accelerator"
      title="Set Your Starting Point"
      description="Choose your start date and add measurements if you want a clear before-and-after record."
    >
      <Section title="Start date">
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice selected>Start today</Choice>
          <Choice>Choose a date</Choice>
        </div>
      </Section>
      <Section title="Starting measurements">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="font-bold">
            Weight <span className="font-normal text-muted-foreground">(optional)</span>
            <Input className="mt-2 min-h-12" placeholder="175" />
          </label>
          <label className="font-bold">
            Waist <span className="font-normal text-muted-foreground">(optional)</span>
            <Input className="mt-2 min-h-12" placeholder="34" />
          </label>
        </div>
      </Section>
      <Action>Start My Accelerator</Action>
    </Page>
  );
}

function AcceleratorReview({ variant }: { variant: string }) {
  if (variant === "complete")
    return (
      <Page
        kicker="28 Days Complete"
        title="You Finished the Accelerator"
        description="Your workouts, measurements, and program history are saved."
      >
        <Section title="Your Finish">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="gxj-display-title text-4xl">24</p>
              <p className="text-sm">workouts</p>
            </div>
            <div>
              <p className="gxj-display-title text-4xl">-6</p>
              <p className="text-sm">pounds</p>
            </div>
            <div>
              <p className="gxj-display-title text-4xl">-2</p>
              <p className="text-sm">inches</p>
            </div>
          </div>
        </Section>
        <Action>View My Progress</Action>
      </Page>
    );
  if (variant === "rest")
    return (
      <Page
        kicker="Day 7 of 28"
        title="Recovery Day"
        description="Rest is today's program. Your next workout opens tomorrow."
      >
        <Section title="Keep It Easy">
          <p>
            A relaxed walk or a few minutes of mobility is enough. You don't need to earn your rest.
          </p>
        </Section>
        <Action>Mark Recovery Complete</Action>
      </Page>
    );
  return (
    <Page
      kicker="Day 9 of 28"
      title="Upper Body B"
      description="Your dumbbell strength workout is ready."
    >
      <Section title="Before You Start">
        <div className="grid gap-4 sm:grid-cols-3">
          <p>
            <strong>Time</strong>
            <br />
            28 minutes
          </p>
          <p>
            <strong>Equipment</strong>
            <br />
            Dumbbells
          </p>
          <p>
            <strong>Effort</strong>
            <br />7 out of 10
          </p>
        </div>
      </Section>
      <WorkoutMediaCard dayNumber={2} code="a03" title="Upper Body B" state={{ type: "ready" }} />
    </Page>
  );
}

function HistoryReview() {
  return (
    <Page
      kicker="28-Day Accelerator"
      title="Program History"
      description="Completed and replaced programs stay here so your work isn't erased."
    >
      <div className="divide-y divide-foreground/15">
        {[
          { n: "Program 2", d: "Active - Day 9" },
          { n: "Program 1", d: "Completed August 28, 2026" },
        ].map((x) => (
          <div className="flex items-center justify-between gap-4 py-5" key={x.n}>
            <div>
              <p className="font-bold">{x.n}</p>
              <p className="text-sm text-muted-foreground">{x.d}</p>
            </div>
            <ChevronRight className="size-5" />
          </div>
        ))}
      </div>
    </Page>
  );
}

function ProgressReview({ variant }: { variant: string }) {
  if (variant === "error")
    return (
      <Page
        kicker="Your Progress"
        title="Progress Couldn't Be Loaded"
        description="Your saved work hasn't been changed."
      >
        <Action>Try Again</Action>
      </Page>
    );
  return (
    <Page
      kicker="Your Progress"
      title={variant === "empty" ? "Build Your First Win" : "See the Work Add Up"}
      description={
        variant === "empty"
          ? "Complete your first day or add a measurement to begin."
          : "Program completion and measurements stay together here."
      }
    >
      <Section title="Current program">
        <div className="flex items-end justify-between">
          <div>
            <p className="gxj-display-title text-5xl">
              {variant === "empty" ? "0" : "9"}
              <span className="text-2xl"> / 28</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">days completed</p>
          </div>
          <span className="font-bold">{variant === "empty" ? "0%" : "32%"}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full bg-gxj-orange"
            style={{ width: variant === "empty" ? "0%" : "32%" }}
          />
        </div>
      </Section>
      {variant !== "empty" ? (
        <Section title="Measurements">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Weight</p>
              <p className="gxj-display-title mt-1 text-4xl">175 lb</p>
              <p className="text-sm">Down 4 lb</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Waist</p>
              <p className="gxj-display-title mt-1 text-4xl">34 in</p>
              <p className="text-sm">Down 1 in</p>
            </div>
          </div>
        </Section>
      ) : (
        <Action>Add Starting Measurements</Action>
      )}
      {variant === "history" ? (
        <Section title="Completed programs">
          <p className="font-bold">28-Day Accelerator</p>
          <p className="text-sm text-muted-foreground">Completed August 28, 2026</p>
        </Section>
      ) : null}
    </Page>
  );
}

function NutritionReview({ variant }: { variant: string }) {
  if (variant === "error")
    return (
      <Page
        kicker="Your Nutrition"
        title="Nutrition Couldn't Be Loaded"
        description="Your targets haven't been changed."
      >
        <Action>Try Again</Action>
      </Page>
    );
  if (variant === "locked")
    return (
      <Page
        kicker="Your Nutrition"
        title="Simple Targets That Fit Your Plan"
        description="Nutrition guidance unlocks with an eligible paid program."
      >
        <Section>
          <ShieldCheck className="size-8" />
          <h2 className="gxj-display-title mt-4 text-3xl uppercase">Not Unlocked</h2>
          <p className="mt-2 text-muted-foreground">
            Included with the 28-Day Fat Loss Accelerator.
          </p>
        </Section>
        <Action>Explore the Accelerator</Action>
      </Page>
    );
  if (variant === "setup")
    return (
      <Page
        kicker="Your Nutrition"
        title="Set Up Your Daily Targets"
        description="Use your current weight to create a practical calorie and protein starting point."
      >
        <Section title="Current weight">
          <div className="flex max-w-sm gap-3">
            <Input className="min-h-12" value="175" readOnly />
            <Button variant="outline">lb</Button>
          </div>
        </Section>
        <Action>Build My Targets</Action>
      </Page>
    );
  return (
    <Page
      kicker="Your Nutrition"
      title="Your Daily Targets"
      description="Use these as a starting point, not a pass-or-fail test."
    >
      {variant === "review" ? (
        <Section>
          <Status>Target Review</Status>
          <h2 className="gxj-display-title mt-4 text-3xl uppercase">Your Weight Changed</h2>
          <p className="mt-2">Review the proposed update before anything changes.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <p>
              <strong>Calories</strong>
              <br />
              2,100 to 2,040
            </p>
            <p>
              <strong>Protein</strong>
              <br />
              175 g to 170 g
            </p>
          </div>
          <div className="mt-5">
            <Action>Review Updated Targets</Action>
          </div>
        </Section>
      ) : null}
      <Section title="Daily targets">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <p className="gxj-display-title text-4xl">2,100</p>
            <p className="text-sm">calories</p>
          </div>
          <div>
            <p className="gxj-display-title text-4xl">175g</p>
            <p className="text-sm">protein</p>
          </div>
          <div>
            <p className="gxj-display-title text-4xl">210g</p>
            <p className="text-sm">carbs</p>
          </div>
          <div>
            <p className="gxj-display-title text-4xl">62g</p>
            <p className="text-sm">fat</p>
          </div>
        </div>
      </Section>
      <Section title="Build your day">
        <p className="leading-relaxed">
          Hit your protein target, keep portions honest, and build most meals around foods that help
          you stay full.
        </p>
      </Section>
    </Page>
  );
}

function NotificationsReview({ empty }: { empty: boolean }) {
  return (
    <Page
      kicker="Account"
      title="Notifications"
      description="Program reminders and important account updates live here."
    >
      {empty ? (
        <Section>
          <h2 className="gxj-display-title text-3xl uppercase">You're All Caught Up</h2>
          <p className="mt-2 text-muted-foreground">New reminders will show here.</p>
        </Section>
      ) : (
        <div className="divide-y divide-foreground/15">
          {[
            { title: "Your next workout is ready", body: "Day 3 - Jump + Strength", time: "Today" },
            {
              title: "Review your nutrition targets",
              body: "Your latest weight may change your daily numbers.",
              time: "Yesterday",
            },
          ].map((x) => (
            <div className="relative py-5 pl-5" key={x.title}>
              <span className="absolute left-0 top-7 size-2 rounded-full bg-gxj-orange" />
              <p className="font-bold">{x.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{x.body}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wider">{x.time}</p>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

function AccountReview({ signedOut }: { signedOut: boolean }) {
  if (signedOut)
    return (
      <div className="mx-auto max-w-lg px-5 py-12 sm:py-20">
        <Status>Private Access</Status>
        <h1 className="gxj-display-title mt-4 text-5xl uppercase leading-none">
          Open Your Gen X Jumps Account
        </h1>
        <p className="mt-4 text-lg leading-relaxed">
          Enter your email and we'll send a secure access link. No password needed.
        </p>
        <label className="mt-7 block font-bold">
          Email address
          <Input className="mt-2 min-h-12" type="email" placeholder="you@example.com" />
        </label>
        <div className="mt-5">
          <Action>Send My Access Link</Action>
        </div>
      </div>
    );
  return (
    <Page
      kicker="Account"
      title="My Account"
      description="Manage your access, purchases, and account settings."
    >
      <Section title="Signed in as">
        <p className="font-bold">todd@example.com</p>
      </Section>
      <div className="divide-y divide-foreground/15">
        {["Purchases and Billing", "Get a Magic Access Link", "Notification Preferences"].map(
          (x) => (
            <div className="flex min-h-16 items-center justify-between py-3 font-bold" key={x}>
              {x}
              <ChevronRight className="size-5" />
            </div>
          ),
        )}
      </div>
      <div className="mt-6">
        <Action outline>Log Out</Action>
      </div>
    </Page>
  );
}

function PurchasesReview() {
  return (
    <Page
      kicker="Account"
      title="Purchases and Billing"
      description="See what you own and find support for an eligible purchase."
    >
      <Section>
        <Status>Paid</Status>
        <h2 className="gxj-display-title mt-4 text-3xl uppercase">28-Day Fat Loss Accelerator</h2>
        <p className="mt-2">Purchased September 10, 2026</p>
        <p className="mt-1 text-sm text-muted-foreground">$47.00 - Visa ending in 4242</p>
        <div className="mt-5">
          <Action outline>View Purchase Details</Action>
        </div>
      </Section>
    </Page>
  );
}

function RefundReview() {
  return (
    <Page
      kicker="Purchase Support"
      title="Request a Refund"
      description="Send the request here. Access stays available while it is reviewed."
    >
      <Section title="28-Day Fat Loss Accelerator">
        <p>Purchased September 10, 2026 - $47.00</p>
      </Section>
      <Section title="Why are you requesting a refund?">
        <textarea
          className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-3"
          placeholder="Tell us what happened"
        />
      </Section>
      <Action>Submit Refund Request</Action>
    </Page>
  );
}

function RecoveryReview() {
  return (
    <div className="mx-auto max-w-lg px-5 py-12 sm:py-20">
      <Status>Secure Access</Status>
      <h1 className="gxj-display-title mt-4 text-5xl uppercase leading-none">
        Get a Magic Access Link
      </h1>
      <p className="mt-4 text-lg leading-relaxed">
        Use the email connected to your plan or purchase. We'll send a secure link that signs you
        in.
      </p>
      <label className="mt-7 block font-bold">
        Email address
        <Input className="mt-2 min-h-12" type="email" placeholder="you@example.com" />
      </label>
      <div className="mt-5">
        <Action>Send My Access Link</Action>
      </div>
    </div>
  );
}

function ReviewBody({ screen }: { screen: ReviewScreen }) {
  switch (screen.kind) {
    case "landing":
      return <LandingReview />;
    case "eligibility":
      return <EligibilityReview />;
    case "assessment":
      return <AssessmentReview step={screen.variant} />;
    case "assessment-result":
      return <AssessmentResultReview replace={screen.variant === "replace"} />;
    case "welcome":
      return <WelcomeReview returning={screen.variant === "returning"} />;
    case "plan-ready":
      return <PlanReadyReview />;
    case "home":
      return <HomeReview variant={screen.variant} />;
    case "plan":
      return <PlanReview complete={screen.variant === "complete"} />;
    case "workout":
      return <WorkoutReview variant={screen.variant} />;
    case "jump-ropes":
      return <JumpRopesReview />;
    case "programs":
      return <ProgramsReview variant={screen.variant} />;
    case "offer":
      return <OfferReview />;
    case "checkout":
      return <CheckoutReview pending={screen.variant === "pending"} />;
    case "accelerator-setup":
      return <AcceleratorSetupReview />;
    case "accelerator":
      return <AcceleratorReview variant={screen.variant} />;
    case "history":
      return <HistoryReview />;
    case "progress":
      return <ProgressReview variant={screen.variant} />;
    case "nutrition":
      return <NutritionReview variant={screen.variant} />;
    case "notifications":
      return <NotificationsReview empty={screen.variant === "empty"} />;
    case "account":
      return <AccountReview signedOut={screen.variant === "signed-out"} />;
    case "purchases":
      return <PurchasesReview />;
    case "refund":
      return <RefundReview />;
    case "recovery":
      return <RecoveryReview />;
  }
}

function activeSection(screen: ReviewScreen) {
  if (
    ["programs", "offer", "checkout", "accelerator-setup", "accelerator", "history"].includes(
      screen.kind,
    )
  )
    return "programs" as const;
  if (screen.kind === "progress") return "progress" as const;
  if (screen.kind === "nutrition") return "nutrition" as const;
  if (["notifications", "account", "purchases", "refund"].includes(screen.kind))
    return "none" as const;
  return "home" as const;
}

export function AppReviewScreen({ screen }: { screen: ReviewScreen }) {
  return (
    <ReviewShell
      mode={screen.shell}
      active={activeSection(screen)}
      unread={screen.kind === "notifications" && screen.variant === "unread"}
    >
      <ReviewBody screen={screen} />
    </ReviewShell>
  );
}
