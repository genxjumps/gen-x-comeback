import {
  ArrowRight,
  Apple,
  Check,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Download,
  Dumbbell,
  ExternalLink,
  Info,
  Mail,
  RotateCcw,
  ShieldCheck,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";

import { AcceleratorOfferPage } from "@/components/accelerator-offer-page";
import { PlatformPage } from "@/components/platform-page";
import { ReviewShell } from "@/components/review-shell";
import { SetupProgress } from "@/components/setup-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkoutMediaCard } from "@/components/workout-media-card";
import { WorkoutLaunchPanel } from "@/components/workout-launch-panel";
import { WorkoutOverview, WorkoutNotes } from "@/components/workout-screen";
import { SevenDayScheduleRow } from "@/components/seven-day-schedule-row";
import { ACCELERATOR_ORIENTATION } from "@/lib/accelerator/content";
import { acceleratorVideoSrc } from "@/lib/accelerator/video";
import type { ReviewScreen } from "@/lib/app-review";
import { WORKOUTS } from "@/lib/plan";
import { sevenDayWorkoutOverview, sevenDayWorkoutRuntime } from "@/lib/workout-presentation";

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
      className="gxj-display-title min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto"
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

function AssessmentChoice({
  children,
  selected = false,
  multiple = false,
}: {
  children: ReactNode;
  selected?: boolean;
  multiple?: boolean;
}) {
  return (
    <div
      className={`relative flex min-h-14 items-center border-2 px-4 py-3 pr-12 text-base font-semibold leading-snug transition-[background-color,border-color,box-shadow,transform] duration-150 ${
        selected
          ? "-translate-x-px -translate-y-px border-gxj-orange bg-gxj-mint shadow-[3px_3px_0_color-mix(in_oklch,var(--color-foreground)_14%,transparent)]"
          : "border-foreground/25 bg-background"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mr-3 grid size-5 shrink-0 place-items-center border-2 ${
          multiple ? "rounded-[2px]" : "rounded-full"
        } ${selected ? "border-gxj-orange" : "border-foreground/35"}`}
      >
        {selected ? (
          <span
            className={`${multiple ? "size-2.5 rounded-[1px]" : "size-2.5 rounded-full"} bg-gxj-orange`}
          />
        ) : null}
      </span>
      {children}
    </div>
  );
}

function Page({
  headerPrefix,
  kicker,
  title,
  description,
  titleSize,
  contentGap,
  children,
}: {
  headerPrefix?: ReactNode;
  kicker?: string;
  title: string;
  description?: string;
  titleSize?: "default" | "compact";
  contentGap?: "default" | "tight";
  children: ReactNode;
}) {
  return (
    <PlatformPage
      headerPrefix={headerPrefix}
      kicker={kicker}
      title={title}
      description={description}
      titleSize={titleSize}
      contentGap={contentGap}
    >
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
          <p className="gxj-display-title text-3xl uppercase tracking-wide sm:text-4xl">
            Today&rsquo;s Workout
          </p>
          <WorkoutLaunchPanel
            day={3}
            title={WORKOUTS.W03.title}
            actionLabel="Open Today’s Workout"
            href="/review/workout-day-3-ready"
          />
        </div>

        <section className="mx-auto mt-8 max-w-3xl" aria-labelledby="fitness-hub">
          <h2
            id="fitness-hub"
            className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl"
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
                  <h3 className="gxj-display-title text-xl uppercase tracking-wide sm:text-2xl">
                    {title}
                  </h3>
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

function EligibilityReview({ ineligible = false }: { ineligible?: boolean }) {
  if (ineligible) {
    return (
      <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
        <header className="py-6 sm:py-8">
          <div className="max-w-2xl">
            <h1 className="gxj-display-title text-3xl uppercase leading-none tracking-wide sm:text-4xl">
              I’m Sorry
            </h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-foreground/75">
              This plan is not designed for rehabilitation, chair-based exercise, assisted exercise,
              or people who cannot complete basic exercise independently.
            </p>
          </div>
        </header>

        <div className="mx-auto mt-1 flex max-w-3xl flex-col-reverse gap-3 border-t border-foreground/20 pt-5 sm:flex-row sm:justify-between">
          <Action outline>Back to start</Action>
          <Action outline>Change my answer</Action>
        </div>
      </div>
    );
  }

  return (
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
      <header className="py-6 sm:py-8">
        <div className="max-w-2xl">
          <h1 className="gxj-display-title text-3xl uppercase leading-none tracking-wide sm:text-4xl">
            Before You Start
          </h1>
          <p className="mt-3 text-base font-medium leading-relaxed text-foreground/75">
            You don’t need to be in great shape. You just need to be able to exercise safely on your
            own.
          </p>
        </div>
      </header>

      <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-bold leading-snug sm:text-2xl">
            Can you safely jump rope, get down to and up from the floor, and do basic bodyweight
            exercises like push-ups, squats, and lunges on your own?
          </h2>
          <div className="mt-5 grid gap-3">
            <AssessmentChoice>Yes</AssessmentChoice>
            <AssessmentChoice selected>Yes, with minor modifications</AssessmentChoice>
            <AssessmentChoice>No</AssessmentChoice>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-1 flex max-w-3xl flex-col-reverse gap-3 border-t border-foreground/20 pt-5 sm:flex-row sm:justify-between">
        <Action outline>Back</Action>
        <Action>Continue</Action>
      </div>
    </div>
  );
}

function AssessmentReview({ step }: { step: string }) {
  const stepNumber = Number(step);
  const title =
    step === "1"
      ? "Your Starting Point"
      : step === "2"
        ? "Jump Rope and Impact"
        : "Finish Your Plan";
  const description =
    step === "1"
      ? "Your answers will help me build a personalized 7-day plan based on what you can do right now."
      : step === "2"
        ? "Your answers will help me adjust the jump rope workouts to your experience and comfort level."
        : "Tell me what equipment you have and how often you can work out. You can also get a daily protein recommendation for maintaining lean muscle mass while losing body fat.";

  const questions =
    step === "1"
      ? [
          {
            heading: "How many structured workouts did you complete in the past seven days?",
            choices: ["None", "1 workout", "2-3 workouts", "4 or more workouts"],
          },
          {
            heading: "Over the past few months, how often have you usually exercised?",
            choices: ["Not at all", "1-2 times per week", "3 or more times per week"],
          },
        ]
      : [
          {
            heading: "What’s your current jump rope experience?",
            choices: [
              "I’ve never jumped rope",
              "I can only do a few jumps before stopping",
              "I can complete up to 10 rounds of 30-60 seconds",
              "I can complete more than 10 rounds of 30-60 seconds",
            ],
          },
          {
            heading: "Do you need to limit jumping or use a lower-impact option during workouts?",
            choices: ["No", "Yes"],
          },
        ];

  return (
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
      <header className="py-6 sm:py-8">
        <div className="max-w-2xl">
          <div className="grid max-w-md grid-cols-3 gap-2" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((segment) => {
              const state =
                segment < stepNumber ? "complete" : segment === stepNumber ? "current" : "upcoming";
              return (
                <div
                  key={segment}
                  aria-current={state === "current" ? "step" : undefined}
                  className={`flex min-h-11 items-center px-3 ${
                    state === "complete"
                      ? "bg-foreground text-background"
                      : state === "current"
                        ? "bg-gxj-orange text-white shadow-[2px_2px_0_color-mix(in_oklch,var(--color-foreground)_18%,transparent)]"
                        : "border-2 border-foreground/20 text-foreground/35"
                  }`}
                >
                  <span className="gxj-display-title text-xl leading-none tracking-wide">
                    {String(segment).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>
          <h1 className="gxj-display-title mt-4 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-foreground/75">
            {description}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl">
        {step !== "3"
          ? questions.map((question, questionIndex) => (
              <section
                key={question.heading}
                className="border-t-2 border-foreground/20 py-6 sm:py-8"
              >
                <h2 className="text-xl font-bold leading-snug sm:text-2xl">{question.heading}</h2>
                <div
                  className={`mt-4 grid gap-3 ${
                    question.choices.every((choice) => choice.length < 28)
                      ? "sm:grid-cols-2"
                      : "grid-cols-1"
                  }`}
                >
                  {question.choices.map((choice, choiceIndex) => (
                    <AssessmentChoice
                      key={choice}
                      selected={
                        step === "2" &&
                        ((questionIndex === 0 && choiceIndex === 1) ||
                          (questionIndex === 1 && choiceIndex === 1))
                      }
                    >
                      {choice}
                    </AssessmentChoice>
                  ))}
                </div>
              </section>
            ))
          : null}

        {step === "3" ? (
          <>
            <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
              <h2 className="text-xl font-bold leading-snug sm:text-2xl">
                Which of these do you regularly have access to for your workouts?
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Select all that apply.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Jump rope",
                  "Dumbbells",
                  "Exercise or jump rope mat",
                  "Rubber gym flooring",
                  "None of these",
                ].map((choice, index) => (
                  <AssessmentChoice key={choice} multiple selected={index === 0 || index === 2}>
                    {choice}
                  </AssessmentChoice>
                ))}
              </div>
            </section>

            <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
              <h2 className="text-xl font-bold leading-snug sm:text-2xl">
                How many days per week can you realistically and consistently complete a short
                workout?
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {["3 days", "4 days", "5 days", "6-7 days"].map((choice, index) => (
                  <AssessmentChoice key={choice} selected={index === 1}>
                    {choice}
                  </AssessmentChoice>
                ))}
              </div>
            </section>

            <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
              <h2 className="text-xl font-bold leading-snug sm:text-2xl">Current weight</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Optional. I’ll use your weight to estimate how much protein to eat each day to help
                maintain muscle while you lose fat. It won’t change your workouts.
              </p>
              <div className="mt-4 flex min-h-14 max-w-md overflow-hidden border-2 border-foreground/25 bg-background">
                <Input
                  aria-label="Current weight"
                  className="h-14 min-w-0 flex-1 rounded-none border-0 bg-transparent px-4 text-lg font-semibold shadow-none"
                  placeholder="Optional"
                  readOnly
                />
                <div className="flex items-center gap-1 border-l-2 border-foreground/20 bg-foreground/5 p-1">
                  <span className="grid size-11 place-items-center bg-foreground font-bold text-background">
                    lb
                  </span>
                  <span className="grid size-11 place-items-center font-bold">kg</span>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <div className="mx-auto mt-1 flex max-w-3xl flex-col-reverse gap-3 border-t border-foreground/20 pt-5 sm:flex-row sm:justify-between">
        <Action outline>Back</Action>
        <Action>{step === "3" ? "Get My 7-Day Fitness Plan" : "Continue"}</Action>
      </div>
      <p className="mt-4 text-center text-sm font-medium text-muted-foreground">
        Your answers are saved as you go.
      </p>
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

function WelcomeReview({ variant }: { variant: string }) {
  if (variant === "setup") {
    const steps = [
      { number: 1, label: "Access saved", state: "complete" },
      { number: 2, label: "Quick setup", state: "current" },
      { number: 3, label: "Plan ready", state: "upcoming" },
    ] as const;

    return (
      <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
        <header className="py-6 sm:py-8">
          <div className="max-w-2xl">
            <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">
              Congratulations
            </p>
            <h1 className="gxj-display-title mt-4 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
              Todd, Let&rsquo;s Build Your Comeback Plan
            </h1>
            <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-foreground/75">
              Answer a few quick questions about your fitness, schedule, equipment, and any
              limitations. Then we&rsquo;ll build your personalized 7-day plan immediately.
            </p>
          </div>
        </header>

        <ol className="grid max-w-3xl grid-cols-3 gap-2" aria-label="Plan setup progress">
          {steps.map((item) => (
            <li
              key={item.label}
              aria-current={item.state === "current" ? "step" : undefined}
              className={`flex min-h-24 flex-col justify-between gap-4 p-3 sm:min-h-28 sm:p-4 ${
                item.state === "complete"
                  ? "bg-foreground text-background"
                  : item.state === "current"
                    ? "bg-gxj-orange text-white shadow-[3px_3px_0_color-mix(in_oklch,var(--color-foreground)_18%,transparent)]"
                    : "border-2 border-foreground/20 text-foreground/35"
              }`}
            >
              <span className="gxj-display-title text-2xl leading-none tracking-wide sm:text-3xl">
                {String(item.number).padStart(2, "0")}
              </span>
              <span className="text-xs font-bold uppercase leading-tight tracking-[0.08em] sm:text-sm">
                {item.label}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-7 max-w-3xl border-t border-foreground/20 pt-5">
          <Action>Create My 7-Day Plan</Action>
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            About 2 minutes. No password required.
          </p>
        </div>
      </div>
    );
  }

  const returning = variant === "returning";
  return (
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
      <header className="py-6 sm:py-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="relative mx-auto mb-7 h-16 w-20" aria-hidden="true">
            <Mail
              className="absolute inset-0 size-16 translate-x-2 translate-y-2 text-gxj-orange"
              strokeWidth={2.2}
            />
            <Mail className="absolute inset-0 size-16 text-foreground" strokeWidth={2.2} />
          </div>
          <h1 className="gxj-display-title text-3xl uppercase leading-none tracking-wide sm:text-4xl">
            {returning ? "Welcome Back" : "Check Your Email"}
          </h1>
          <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-foreground/75">
            {returning
              ? "We found an existing Gen X Jumps account. Use the secure link we sent to get back in."
              : "Your secure access link is on its way. Open it on the device where you want to use your plan."}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl border-t border-foreground/20 pt-5 text-center">
        <Action>{returning ? "Send Another Link" : "Open My Email"}</Action>
      </div>
    </div>
  );
}

function PlanReadyReview() {
  return (
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
      <header className="py-6 sm:py-8">
        <div className="max-w-2xl">
          <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">
            Your Plan Is Ready
          </p>
          <h1 className="gxj-display-title mt-4 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
            Todd, Keep Your Comeback One Tap Away
          </h1>
          <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-foreground/75">
            Add Gen X Jumps to your Home Screen for quick access to your workouts, nutrition
            targets, and progress.
          </p>
        </div>
      </header>

      <div className="max-w-2xl">
        <Button
          type="button"
          size="lg"
          className="gxj-display-title min-h-20 w-full justify-between gap-5 bg-foreground px-5 text-left text-2xl uppercase leading-none tracking-wide text-background shadow-[3px_3px_0_color-mix(in_oklch,var(--color-foreground)_14%,transparent)] hover:bg-foreground/90 sm:px-7 sm:text-3xl"
        >
          Add to My Home Screen
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-background text-gxj-orange sm:size-12">
            <Download aria-hidden="true" className="size-5" strokeWidth={2.5} />
          </span>
        </Button>
        <p className="mt-3 text-sm font-medium text-muted-foreground">No app store required.</p>
        <button
          type="button"
          className="mt-5 block min-h-11 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Not Now - View My Plan
        </button>
      </div>
    </div>
  );
}

const PLAN_REVIEW_DAYS = [
  { day: 1, title: WORKOUTS.W01.title, href: "/review/workout-ready" },
  { day: 2, title: WORKOUTS.W02.title, href: "/review/workout-day-2-ready" },
  { day: 3, title: WORKOUTS.W03.title, href: "/review/workout-day-3-ready" },
  { day: 4, title: WORKOUTS.W04.title, href: "/review/workout-day-4-ready" },
  { day: 5, title: WORKOUTS.W05.title, href: "/review/workout-day-5-ready" },
  { day: 6, title: WORKOUTS.W06.title, href: "/review/workout-day-6-ready" },
  { day: 7, title: WORKOUTS.W07.title, href: "/review/workout-day-7-ready" },
] as const;

function PlanReview({ complete }: { complete: boolean }) {
  const completedDays = complete ? 7 : 2;

  return (
    <Page
      kicker={complete ? "Plan Complete" : `${completedDays} of 7 Days Complete`}
      title={complete ? "Your Week Is Complete" : "Your 7-Day Plan"}
      description={
        complete
          ? "Every day stays here whenever you want to review it."
          : "Day 3 is ready. Keep moving through the week one day at a time."
      }
      titleSize="compact"
      contentGap="tight"
    >
      <div
        className="h-2 w-full overflow-hidden rounded-[2px] bg-foreground/10"
        role="progressbar"
        aria-label="7-Day plan progress"
        aria-valuemin={0}
        aria-valuemax={7}
        aria-valuenow={completedDays}
      >
        <div
          className="h-full bg-gxj-orange"
          style={{ width: `${Math.round((completedDays / 7) * 100)}%` }}
        />
      </div>

      {!complete ? (
        <section className="mt-8" aria-labelledby="plan-today">
          <h2
            id="plan-today"
            className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl"
          >
            Today&rsquo;s Workout
          </h2>
          <WorkoutLaunchPanel
            day={3}
            title={WORKOUTS.W03.title}
            actionLabel="Open Today’s Workout"
            href="/review/workout-day-3-ready"
          />
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="plan-schedule">
        <h2
          id="plan-schedule"
          className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl"
        >
          Your 7-Day Schedule
        </h2>
        <div className="mt-3 divide-y divide-foreground/15 border-t-2 border-foreground">
          {PLAN_REVIEW_DAYS.map(({ day, title, href }) => {
            const finished = complete || day <= 2;
            const current = !complete && day === 3;
            const stateLabel = finished ? "Complete" : current ? "Today" : "Upcoming";
            return (
              <a
                href={href}
                key={day}
                aria-label={`Day ${day}: ${title}. ${stateLabel}.`}
                aria-current={current ? "step" : undefined}
                className="group -mx-3 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gxj-orange focus-visible:ring-offset-2"
              >
                <SevenDayScheduleRow
                  day={day}
                  title={title}
                  state={finished ? "completed" : current ? "current" : "upcoming"}
                  stateLabel={stateLabel}
                />
              </a>
            );
          })}
        </div>
      </section>

      <section className="mt-8 border-t-2 border-foreground pt-6" aria-labelledby="plan-details">
        <h2
          id="plan-details"
          className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl"
        >
          Your Plan Details
        </h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2 sm:gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/55">
              Daily Protein Target
            </p>
            <p className="gxj-display-title mt-2 text-4xl uppercase leading-none">175 G</p>
            <p className="mt-2 text-sm text-foreground/70">Based on the weight you provided.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/55">
              Workout Approach
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              Work at your pace, take more rest when needed, and use the easier option whenever you
              need it.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-8 border-t border-foreground/15 pt-6">
        <Action outline>{complete ? "Start This Plan Again" : "Change My Answers"}</Action>
      </div>
    </Page>
  );
}

function WorkoutReview({ variant }: { variant: string }) {
  const fullRest = variant === "recovery";
  const readyWorkoutMatch = /^ready-w0([1-7])$/.exec(variant);
  const readyWorkoutNumber = readyWorkoutMatch ? Number(readyWorkoutMatch[1]) : null;
  const day = fullRest
    ? 7
    : (readyWorkoutNumber ??
      (variant === "blocked" ? 3 : variant === "scheduled" ? 4 : variant === "completed" ? 2 : 1));
  const code = `W0${day}`;
  const workout = WORKOUTS[code] ?? WORKOUTS.W01;
  const activeRecovery = code === "W07";
  const runtime = sevenDayWorkoutRuntime(code, workout.minutes);
  return (
    <Page
      kicker={`Day ${day} of 7`}
      title={fullRest ? "Full Rest" : workout.title}
      titleSize="compact"
      contentGap="tight"
      description={
        fullRest
          ? "Recovery is part of the plan. Take the day off and let your body absorb the work."
          : activeRecovery
            ? `${runtime} total. Keep the movement easy.`
            : `${runtime} total. Use the easier option any time you need it.`
      }
    >
      {fullRest ? (
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
          dayLabel={`Day ${day} of 7`}
          code={code}
          title={workout.title}
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
      {!fullRest ? (
        <WorkoutOverview items={sevenDayWorkoutOverview(code, workout.minutes)} />
      ) : null}
      {!fullRest ? (
        <WorkoutNotes>
          <p className="leading-relaxed">
            Move at a pace you can control. Take more rest when you need it. Stop if you feel sharp
            pain, dizziness, or anything that doesn't feel right.
          </p>
        </WorkoutNotes>
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
            title: "Fat Loss Accelerator",
            detail: "Ready when you want more structure",
            action: "Explore the Accelerator",
            program: "accelerator",
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
            title: "Fat Loss Accelerator",
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
            program: "accelerator",
          },
          {
            status: variant === "complete" ? "COMPLETED" : "ACTIVE",
            title: "Comeback Plan",
            detail: variant === "complete" ? "Completed September 7, 2026" : "Day 3 of 7",
            action: "Open My Plan",
            program: "seven-day",
          },
        ];
  return (
    <Page
      title={error ? "Your Programs Couldn't Be Loaded" : "Your Programs"}
      titleSize="compact"
      description={error ? "Try again without leaving the app." : undefined}
    >
      {error ? (
        <div className="py-4">
          <Action>Try Again</Action>
        </div>
      ) : (
        <div className="divide-y-2 divide-foreground border-y-2 border-foreground">
          {entries.map((entry) => {
            const accelerator = entry.program === "accelerator";
            return (
              <section className="py-7 sm:py-8" key={entry.title}>
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-6">
                  <span
                    aria-hidden="true"
                    className={`grid aspect-square place-items-center ${
                      accelerator ? "bg-gxj-aqua text-foreground" : "bg-foreground text-background"
                    }`}
                  >
                    <span className="flex flex-col items-center leading-none">
                      <span className="gxj-display-title text-4xl sm:text-5xl">
                        {accelerator ? "28" : "7"}
                      </span>
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]">
                        Day
                      </span>
                    </span>
                  </span>
                  <div>
                    <p
                      className={`text-xs font-bold uppercase tracking-[0.14em] ${
                        accelerator ? "text-foreground" : "text-foreground/60"
                      }`}
                    >
                      {entry.status}
                    </p>
                    <h2 className="gxj-display-title mt-2 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
                      {entry.title}
                    </h2>
                    <p className="mt-2 font-medium text-foreground/70">{entry.detail}</p>
                    <div className="mt-5">
                      <Action>
                        {entry.action}
                        <ArrowRight className="size-4" />
                      </Action>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}

function OfferReview() {
  return <AcceleratorOfferPage actionLabel="Get the Fat Loss Accelerator" />;
}

function CheckoutReview({ pending }: { pending: boolean }) {
  return (
    <Page
      kicker={pending ? "Purchase Received" : "You Own It"}
      title={pending ? "We’re Finishing Your Purchase" : "Your New Program Is Ready"}
      description={
        pending
          ? "Your payment went through. We’re adding your 28-Day Fat Loss Accelerator to My Programs."
          : "You can find your 28-Day Fat Loss Accelerator under My Programs."
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
                ? "Wait here, or tap Check Again if the page doesn’t update."
                : "Set it up now or come back when you're ready."}
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
      kicker="28-Day Fat Loss Accelerator"
      title="Set Your Starting Point"
      description="Review how the program works, then add starting measurements if you want a clear before-and-after record. Both measurements are optional."
      titleSize="compact"
    >
      <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
        <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
          {ACCELERATOR_ORIENTATION.title}
        </h2>
        <div className="mt-4 flex aspect-video items-center justify-center border-2 border-dashed border-foreground/25 bg-background/60 px-5 text-center">
          <div>
            <Video className="mx-auto size-8 text-foreground/55" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold">Orientation video coming soon</p>
          </div>
        </div>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-foreground/80">
          {ACCELERATOR_ORIENTATION.writtenExplanation.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
      <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
        <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
          Starting Measurements
        </h2>
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          Both are optional. Skip either one or both and start anyway.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="font-bold">
            Weight - lb
            <Input className="mt-2 min-h-14" placeholder="Optional" />
          </label>
          <label className="font-bold">
            Waist - in
            <Input className="mt-2 min-h-14" placeholder="Optional" />
          </label>
        </div>
      </section>
      <div className="mt-1 border-t border-foreground/20 pt-5">
        <Action>Begin Day 1</Action>
      </div>
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

  if (variant === "workout")
    return (
      <Page
        kicker="Day 9 of 28"
        title="Workout B - EMOM"
        description="27:30 total."
        titleSize="compact"
        contentGap="tight"
      >
        <WorkoutMediaCard
          dayNumber={9}
          dayLabel="Day 9 of 28"
          code="accelerator-workout-b"
          title="Workout B - EMOM"
          videoSrc={acceleratorVideoSrc("a863bce8634666b5766ff277685b6b83")}
          accent="aqua"
          artworkVariant="accelerator"
          state={{ type: "ready" }}
        />
        <WorkoutOverview
          items={[
            { label: "Duration", value: "27:30" },
            { label: "Equipment", value: "Jump Rope + Bodyweight" },
            { label: "Focus", value: "Conditioning + Core" },
            { label: "Format", value: "EMOM" },
          ]}
        />
        <WorkoutNotes>
          <p className="leading-relaxed">
            Complete Workout B. Stay controlled through each minute, scale reps or rest when needed,
            then complete the day when you are finished.
          </p>
        </WorkoutNotes>
      </Page>
    );

  const weekTwoDays = [
    { day: 8, title: "Workout A - Classic Intervals", state: "completed" },
    { day: 9, title: "Workout B - EMOM", state: "current" },
    { day: 10, title: "Workout C - Lower Body Ladder", state: "upcoming" },
    { day: 11, title: "Workout D - Intervals", state: "upcoming" },
    { day: 12, title: "Workout E - Pyramid Challenge", state: "upcoming" },
    { day: 13, title: "Workout F - Active Recovery", state: "upcoming" },
    { day: 14, title: "Rest Day", state: "upcoming" },
  ] as const;

  return (
    <Page title="Fat Loss Accelerator" titleSize="compact" contentGap="tight">
      <section className="border-y-2 border-foreground py-5 sm:py-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em]">Week 2</p>
            <p className="gxj-display-title mt-1 text-2xl uppercase tracking-wide sm:text-3xl">
              8 of 28 Days Complete
            </p>
          </div>
          <p className="gxj-display-title text-2xl uppercase tracking-wide text-gxj-aqua sm:text-3xl">
            29%
          </p>
        </div>
        <div
          className="mt-4 h-3 overflow-hidden bg-foreground/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={28}
          aria-valuenow={8}
          aria-label="Accelerator progress"
        >
          <div className="h-full w-[29%] bg-gxj-aqua" />
        </div>
      </section>

      <section className="pt-8 sm:pt-10">
        <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
          Today&rsquo;s Workout
        </h2>
        <WorkoutLaunchPanel
          day={9}
          totalDays={28}
          title="Workout B - EMOM"
          actionLabel="Open Today’s Workout"
          accent="aqua"
          coverSrc="/workout-covers/accelerator-day-09.webp"
          href="/review/accelerator-workout-day-9"
        />
      </section>

      <section className="pt-8 sm:pt-10">
        <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
          Your 28-Day Schedule
        </h2>
        <div className="mt-5 grid grid-cols-4 border-y-2 border-foreground">
          {[1, 2, 3, 4].map((week) => (
            <button
              type="button"
              key={week}
              className={`min-h-12 border-r border-foreground px-2 text-sm font-bold uppercase last:border-r-0 ${
                week === 2 ? "bg-gxj-aqua text-foreground" : "bg-background text-foreground"
              }`}
            >
              Week {week}
            </button>
          ))}
        </div>
        <div className="divide-y divide-foreground/20">
          {weekTwoDays.map((day) => {
            const completed = day.state === "completed";
            const current = day.state === "current";
            return (
              <div
                className={`grid min-h-24 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 py-4 ${
                  current ? "bg-gxj-aqua/15 px-3" : "px-3"
                } ${completed ? "text-foreground/40" : "text-foreground"}`}
                key={day.day}
              >
                <span
                  className={`gxj-display-title grid aspect-square place-items-center text-2xl ${
                    current
                      ? "bg-gxj-aqua text-foreground"
                      : completed
                        ? "border-2 border-foreground/25"
                        : "bg-foreground text-background"
                  }`}
                >
                  {String(day.day).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.14em]">
                    {completed ? "Complete" : current ? "Today" : `Day ${day.day}`}
                  </p>
                  <p className="gxj-display-title mt-1 text-xl uppercase leading-tight tracking-wide sm:text-2xl">
                    {day.title}
                  </p>
                </div>
                <ChevronRight aria-hidden="true" className="size-5" />
              </div>
            );
          })}
        </div>
      </section>
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
        title="Your Progress"
        description="Your saved work hasn't been changed."
        titleSize="compact"
      >
        <Section title="Progress Couldn't Be Loaded">
          <Action>Try Again</Action>
        </Section>
      </Page>
    );
  return (
    <Page
      title="Your Progress"
      description={
        variant === "empty"
          ? "Complete your first day or add a measurement to begin."
          : "Program completion and measurements stay together here."
      }
      titleSize="compact"
    >
      <Section title="Current program">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em]">
              28-Day Fat Loss Accelerator
            </p>
            <p className="gxj-display-title mt-1 text-2xl uppercase tracking-wide sm:text-3xl">
              {variant === "empty" ? "0" : "9"} of 28 Days Complete
            </p>
          </div>
          <p className="gxj-display-title text-2xl uppercase tracking-wide text-gxj-aqua sm:text-3xl">
            {variant === "empty" ? "0%" : "32%"}
          </p>
        </div>
        <div className="mt-4 h-3 overflow-hidden bg-foreground/15">
          <div
            className="h-full bg-gxj-aqua"
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

function NutritionSetupSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
      <h2 className="text-xl font-bold leading-snug sm:text-2xl">{title}</h2>
      {hint ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function NutritionSetupReview({ step }: { step: 1 | 2 | 3 }) {
  return (
    <Page
      headerPrefix={<SetupProgress currentStep={step} label="Nutrition setup progress" />}
      title="Set Up Your Daily Targets"
      description="Build starting targets, see how they fit across your normal day, and repeat meals that work."
      titleSize="compact"
    >
      {step === 1 ? (
        <>
          <NutritionSetupSection title="What is your current fitness goal?">
            <div className="grid gap-3">
              <AssessmentChoice selected>Lose fat</AssessmentChoice>
              <AssessmentChoice>Add lean muscle and lose fat</AssessmentChoice>
              <AssessmentChoice>Add lean muscle</AssessmentChoice>
              <AssessmentChoice>Maintain your results</AssessmentChoice>
            </div>
          </NutritionSetupSection>
          <NutritionSetupSection title="What do you want your body weight to do?">
            <div className="grid gap-3 sm:grid-cols-2">
              <AssessmentChoice selected>Lose weight</AssessmentChoice>
              <AssessmentChoice>Maintain my current weight</AssessmentChoice>
              <AssessmentChoice>Add weight slowly</AssessmentChoice>
            </div>
          </NutritionSetupSection>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <NutritionSetupSection title="Your starting numbers">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="font-bold">
                Current weight
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                  <Input className="min-h-14" value="175" readOnly />
                  <div className="flex min-h-14 items-center border border-input px-3 text-sm">
                    lb
                  </div>
                </div>
              </label>
              <label className="font-bold">
                Goal weight
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                  <Input className="min-h-14" value="165" readOnly />
                  <div className="flex min-h-14 items-center border border-input px-3 text-sm">
                    lb
                  </div>
                </div>
              </label>
              <label className="font-bold">
                Height
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input className="min-h-14" value="6" readOnly />
                  <Input className="min-h-14" value="1" readOnly />
                </div>
              </label>
              <label className="font-bold">
                Age
                <Input className="mt-2 min-h-14" value="59" readOnly />
              </label>
            </div>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium">Sex used for the calorie calculation</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <AssessmentChoice selected>Male</AssessmentChoice>
                <AssessmentChoice>Female</AssessmentChoice>
              </div>
            </fieldset>
          </NutritionSetupSection>
          <NutritionSetupSection title="Outside of workouts, how active is your typical day?">
            <div className="grid gap-3 sm:grid-cols-2">
              <AssessmentChoice selected>Mostly sitting</AssessmentChoice>
              <AssessmentChoice>On my feet most of the day</AssessmentChoice>
              <AssessmentChoice>Physically active work</AssessmentChoice>
            </div>
          </NutritionSetupSection>
          <NutritionSetupSection title="How are you training right now?">
            <div className="grid gap-3 sm:grid-cols-2">
              <AssessmentChoice>Jump rope or conditioning</AssessmentChoice>
              <AssessmentChoice>Strength training</AssessmentChoice>
              <AssessmentChoice selected>Both</AssessmentChoice>
              <AssessmentChoice>Not training right now</AssessmentChoice>
            </div>
          </NutritionSetupSection>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <NutritionSetupSection
            title="On a typical weekday, which of these eating occasions do you use?"
            hint="Choose at least one. This shapes the meal-by-meal view, not your daily targets."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <AssessmentChoice multiple selected>
                Breakfast
              </AssessmentChoice>
              <AssessmentChoice multiple selected>
                Lunch
              </AssessmentChoice>
              <AssessmentChoice multiple selected>
                Dinner
              </AssessmentChoice>
              <AssessmentChoice multiple>Snacks, shakes, or dessert</AssessmentChoice>
            </div>
          </NutritionSetupSection>
          <NutritionSetupSection title="Which meal tends to be your biggest?">
            <div className="grid gap-3 sm:grid-cols-2">
              <AssessmentChoice>Breakfast</AssessmentChoice>
              <AssessmentChoice>Lunch</AssessmentChoice>
              <AssessmentChoice selected>Dinner</AssessmentChoice>
              <AssessmentChoice>They&rsquo;re about the same</AssessmentChoice>
            </div>
          </NutritionSetupSection>
        </>
      ) : null}

      <div className="mt-1 flex flex-col-reverse gap-3 border-t border-foreground/20 pt-5 sm:flex-row sm:justify-between">
        <Action outline>Back</Action>
        <Action>{step === 3 ? "Calculate My Targets" : "Continue"}</Action>
      </div>
      <p className="mt-4 text-center text-sm font-medium text-muted-foreground">
        Your answers are saved as you go.
      </p>
    </Page>
  );
}

function NutritionReview({ variant }: { variant: string }) {
  if (variant === "error")
    return (
      <Page
        kicker="Your Nutrition"
        title="Nutrition Couldn't Be Loaded"
        description="We couldn't confirm your account or load your saved nutrition targets. Nothing was changed."
      >
        <Action>Try Again</Action>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Still not working?{" "}
          <span className="font-semibold text-foreground underline underline-offset-4">
            Sign in again.
          </span>
        </p>
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
          <div className="text-center">
            <ShieldCheck className="mx-auto size-8" />
            <h2 className="gxj-display-title mt-4 text-3xl uppercase">Not Unlocked</h2>
            <p className="mt-2 text-muted-foreground">
              Included with the 28-Day Fat Loss Accelerator.
            </p>
          </div>
        </Section>
        <Action>Explore the Accelerator</Action>
      </Page>
    );
  if (variant === "welcome")
    return (
      <Page
        kicker="Nutrition"
        title="Calories Matter. Protein First. Meals Stay Simple."
        description="Build starting targets, see how they fit across your normal day, and repeat meals that work. No food logging required."
        titleSize="compact"
      >
        <div className="max-w-lg">
          <Action>Set Up My Starting Targets</Action>
          <a
            href="https://genxjumps.com/nutrition/"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"
          >
            Learn the nutrition basics on Gen X Jumps
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </div>
      </Page>
    );
  if (variant.startsWith("setup")) {
    const step = variant === "setup-2" ? 2 : variant === "setup-3" ? 3 : 1;
    return <NutritionSetupReview step={step} />;
  }
  return (
    <Page
      title="Your Nutrition"
      description="These are the numbers to follow each day. Hit your calorie and protein targets consistently to lose fat and protect muscle."
      titleSize="compact"
    >
      {variant === "review" ? (
        <Section>
          <Status>Target Review</Status>
          <h2 className="gxj-display-title mt-4 text-3xl uppercase">Your Weight Changed</h2>
          <p className="mt-2 text-base leading-relaxed">
            Review the proposed update before anything changes.
          </p>
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
      <div>
        <section className="border-b border-foreground/15 pb-6 sm:pb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
                Starting Targets
              </h2>
              <p className="mt-2 text-base font-medium leading-relaxed">
                These are your numbers for the whole day. Every meal counts. All seven days count.
              </p>
            </div>
            <Button type="button" variant="outline">
              Update Targets
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 border-l border-t border-foreground/25 sm:grid-cols-4">
            {[
              ["Calories", "2,100"],
              ["Protein", "175 g"],
              ["Carbs", "210 g"],
              ["Fat", "62 g"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex min-h-32 flex-col justify-center border-b border-r border-foreground/25 p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {label}
                </p>
                <p className="gxj-display-title mt-3 text-xl uppercase leading-[0.95] tracking-wide sm:text-2xl">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <details className="mt-4 rounded-md border border-border bg-muted/30 p-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
              <Info aria-hidden="true" className="size-4" />
              What are these?
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Starting estimate, not medical nutrition advice. If you follow a medical diet or have
              been told to limit protein, work with a registered dietitian.
            </p>
          </details>
        </section>

        <section className="border-b border-foreground/15 py-6 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
                Your Normal Day
              </p>
              <h2 className="gxj-display-title mt-2 text-2xl uppercase tracking-wide sm:text-3xl">
                See how the numbers work across your day.
              </h2>
            </div>
            <Button type="button" variant="outline" size="sm">
              Adjust Your Day
            </Button>
          </div>
          <p className="mt-3 text-base leading-relaxed">
            Adjust the sliders to match how you actually eat. This changes the split, not your daily
            totals.
          </p>
          <div className="mt-5 divide-y divide-foreground/15 border-y border-foreground/15">
            {[
              {
                meal: "Breakfast",
                percentage: "25%",
                targets: [
                  { label: "Calories", value: "525" },
                  { label: "Protein", value: "44 g" },
                  { label: "Carbs", value: "53 g" },
                  { label: "Fat", value: "16 g" },
                ],
              },
              {
                meal: "Lunch",
                percentage: "25%",
                targets: [
                  { label: "Calories", value: "525" },
                  { label: "Protein", value: "44 g" },
                  { label: "Carbs", value: "53 g" },
                  { label: "Fat", value: "16 g" },
                ],
              },
              {
                meal: "Dinner",
                percentage: "50%",
                targets: [
                  { label: "Calories", value: "1,050" },
                  { label: "Protein", value: "87 g" },
                  { label: "Carbs", value: "104 g" },
                  { label: "Fat", value: "30 g" },
                ],
              },
            ].map(({ meal, percentage, targets }) => (
              <div key={meal} className="py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="gxj-display-title text-xl uppercase tracking-wide sm:text-2xl">
                    {meal}
                  </h3>
                  <p className="gxj-display-title translate-y-1 text-xl uppercase tracking-wide sm:text-2xl">
                    {percentage}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                  {targets.map(({ label, value }) => (
                    <div key={label}>
                      <p className="gxj-display-title text-xl uppercase leading-none tracking-wide sm:text-2xl">
                        {value}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-foreground/15 py-6 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
            Build Meals That Work
          </p>
          <h2 className="gxj-display-title mt-2 text-2xl uppercase tracking-wide sm:text-3xl">
            Keep the food simple.
          </h2>
          <p className="mt-3 text-base leading-relaxed">
            Start with protein. Use labels, serving sizes, and standard nutrition information to fit
            the rest of each meal to its numbers. A small rotation is enough: one or two breakfasts,
            one or two lunches, up to three dinners, and a few smart snack options.
          </p>
          <p className="mt-3 text-base leading-relaxed">
            Lean meat, eggs, potatoes, rice, beans, vegetables, fruit, yogurt, and other foods with
            predictable numbers make this easier. Plenty of filling, enjoyable food fits the plan.
            You do not have to go hungry.
          </p>
        </section>

        <section className="border-b border-foreground/15 py-6 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
            My Normal Day
          </p>
          <h2 className="gxj-display-title mt-2 text-2xl uppercase tracking-wide sm:text-3xl">
            I keep the structure and adjust the extras.
          </h2>
          <p className="mt-3 text-base leading-relaxed">
            Most of my meals stay the same when I want to lean out. I do not rebuild my whole diet.
            I remove or reduce the parts adding extra calories while keeping the protein-centered
            structure and foods I already like.
          </p>
          <div className="mt-5 grid divide-y divide-foreground/15 border-y border-foreground/15 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="py-4 sm:py-0 sm:pr-5">
              <h3 className="gxj-display-title text-xl uppercase tracking-wide sm:text-2xl">
                Maintenance
              </h3>
              <ul className="mt-3 space-y-2 text-base leading-relaxed">
                <li>
                  <strong>Breakfast:</strong> 1 cup egg whites, 3 whole eggs, 1/2 cup uncooked
                  oatmeal, 5 g creatine
                </li>
                <li>
                  <strong>Lunch:</strong> 1 banana and 25 g protein powder
                </li>
                <li>
                  <strong>Dinner:</strong> 1 lb 99% lean ground chicken, 1/2 Japanese sweet potato,
                  1/2 can black beans, 1/2 can sweet peas, hot sauce
                </li>
                <li>
                  <strong>Dessert:</strong> 50 g protein powder
                </li>
              </ul>
            </div>
            <div className="py-4 sm:py-0 sm:pl-5">
              <h3 className="gxj-display-title text-xl uppercase tracking-wide sm:text-2xl">
                When I want to cut body fat
              </h3>
              <ul className="mt-3 space-y-2 text-base leading-relaxed">
                <li>
                  <strong>Breakfast:</strong> 1 cup egg whites, 3 whole eggs, 5 g creatine
                </li>
                <li>
                  <strong>Lunch:</strong> 1 banana and 25 g protein powder
                </li>
                <li>
                  <strong>Dinner:</strong> 1 lb 99% lean ground chicken, 1/2 Japanese sweet potato,
                  1/2 can black beans, hot sauce
                </li>
                <li>
                  <strong>Dessert:</strong> 50 g protein powder
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-base leading-relaxed">
            This is how I use the method. It is not a command for you to eat the same foods I eat.
            Find foods you like, check the labels and serving sizes, and make them fit your targets.
          </p>
        </section>

        <section className="border-b border-foreground/15 py-6 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal">
            Read The Label
          </p>
          <h2 className="gxj-display-title mt-2 text-2xl uppercase tracking-wide sm:text-3xl">
            Check what you drink and what you pour.
          </h2>
          <p className="mt-3 text-base leading-relaxed">
            Regular soda, juice, sweetened coffee or tea, calorie-containing flavored drinks,
            dressing, mayo, oils, butter, cheese, ketchup, and barbecue sauce can add up fast. Read
            the label. Check the serving size. Measure it when needed.
          </p>
          <p className="mt-3 text-base leading-relaxed">
            Sugar can appear as cane sugar, high-fructose corn syrup, corn syrup, glucose, dextrose,
            fructose, honey, molasses, syrup, or fruit-juice concentrate. Turn the package over.
            Check calories, total carbohydrate, added sugars, fiber, and serving size.
          </p>
        </section>

        <section className="border-b border-foreground/15 py-6 sm:py-8">
          <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
            If You Miss
          </h2>
          <p className="mt-2 text-base font-semibold leading-relaxed">
            You messed up a meal. Fine. Do not turn one decision into a lost day or a lost weekend.
            Do not punish it by starving tomorrow. Do not wait for Monday. Your next meal is your
            next chance to get back on target. Make the next choice better and keep going.
          </p>
        </section>

        <section className="border-b border-foreground/15 py-6 sm:py-8">
          <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
            If results stall
          </h2>
          <p className="mt-2 text-base leading-relaxed">
            Review labels, portions, drinks, dressings, sauces, serving sizes, calorie-dense foods,
            and consistency before rebuilding the whole diet. This app cannot verify what you ate.
          </p>
        </section>

        <a
          href="https://genxjumps.com/nutrition/"
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 font-semibold transition-colors hover:bg-muted/35"
        >
          <span>
            <span className="gxj-display-title block text-xl uppercase tracking-wide sm:text-2xl">
              Learn the basics
            </span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Deeper nutrition explanations and examples on Gen X Jumps.
            </span>
          </span>
          <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
        </a>
      </div>
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
      return <EligibilityReview ineligible={screen.variant === "ineligible"} />;
    case "assessment":
      return <AssessmentReview step={screen.variant} />;
    case "assessment-result":
      return <AssessmentResultReview replace={screen.variant === "replace"} />;
    case "welcome":
      return <WelcomeReview variant={screen.variant} />;
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
  const acceleratorAccent = [
    "programs",
    "offer",
    "checkout",
    "accelerator-setup",
    "accelerator",
    "history",
  ].includes(screen.kind);

  return (
    <ReviewShell
      mode={screen.shell}
      active={activeSection(screen)}
      accent={acceleratorAccent ? "aqua" : "orange"}
      unread={screen.kind === "notifications" && screen.variant === "unread"}
    >
      <ReviewBody screen={screen} />
    </ReviewShell>
  );
}
