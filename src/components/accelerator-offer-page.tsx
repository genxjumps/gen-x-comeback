import { ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";

import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";

const BEFORE_PHOTO =
  "https://imagedelivery.net/wmhzoNsPEpPXHu1pd_0qNw/6ba452cc-6dfa-4d5b-796c-2777580a8700/public";
const CURRENT_PHOTO =
  "https://imagedelivery.net/wmhzoNsPEpPXHu1pd_0qNw/c8f3774a-ce2c-4e2b-0035-9ea6f3868c00/public";

const included = [
  ["A day-by-day plan", "Open the program and see exactly which workout comes next."],
  [
    "Five guided workouts each week",
    "Train with Todd through jump-rope conditioning and bodyweight strength with the timing built in.",
  ],
  [
    "A coaching focus for each week",
    "Use four short primers to understand what matters now and how your execution should improve.",
  ],
  [
    "Your Nutrition targets",
    "Get clear starting targets for daily calories and protein, then divide them across the meals you actually eat.",
  ],
  [
    "Progress you can see",
    "Track program completion and optional measurements without turning the program into another logging job.",
  ],
  [
    "Access that does not expire",
    "Buy the Accelerator once, keep it, and receive future improvements made to this same program.",
  ],
] as const;

const weeks = [
  ["Week 1", "Establish Your Starting Pace", "Learn the flow and find the effort you can control."],
  ["Week 2", "Waste Less Time", "Recover your rhythm faster and make more of each interval count."],
  ["Week 3", "Increase the Quality", "Add pace or good repetitions where your control allows it."],
  [
    "Week 4",
    "Complete Your Best Week",
    "Use what you learned to deliver your strongest execution.",
  ],
] as const;

const faqs = [
  [
    "Who is this program designed for?",
    "Adults 50+ who are ready to follow one demanding four-week plan to lose fat, rebuild fitness, and feel athletic again.",
  ],
  [
    "How is this different from the free 7-Day Plan?",
    "The Accelerator is a larger commitment with five guided workouts each week, four weeks of progression, weekly coaching, full Nutrition targets, and program tracking.",
  ],
  ["How long are the workouts?", "Plan on about 24 to 28 minutes for each guided workout."],
  [
    "What equipment do I need?",
    "A jump rope and enough clear space to move. The strength work is bodyweight-based, so you do not need a gym or weights.",
  ],
  [
    "What if I am still learning to jump rope?",
    "The program uses fundamentals, not tricks. Work at a pace you can control, restart after rope trips, and use the provided modifications when needed.",
  ],
  [
    "What happens if I miss a day?",
    "Return to the program day you were on and keep going. A missed day does not erase your work or force you to skip ahead.",
  ],
  [
    "Will Todd coach me personally?",
    "No. This is a self-guided program. Todd leads every workout and provides the weekly coaching, but it is not live or one-on-one coaching.",
  ],
  [
    "Does my access expire?",
    "No. Your purchase gives you ongoing access to this version of the Accelerator and future improvements made to the same program.",
  ],
  [
    "How does the seven-day refund period work?",
    "Get into the program and experience the first week. If you decide it is not the right fit, request a refund within seven days of purchase.",
  ],
] as const;

function OfferSection({
  kicker,
  title,
  children,
  dark = false,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <section
      className={`border-t border-foreground/15 py-8 sm:py-10 ${
        dark ? "-mx-5 bg-foreground px-5 text-background sm:-mx-8 sm:px-8" : ""
      }`}
    >
      {kicker ? (
        <p
          className={`text-xs font-bold uppercase tracking-[0.16em] ${
            dark ? "text-gxj-aqua" : "text-foreground/60"
          }`}
        >
          {kicker}
        </p>
      ) : null}
      <h2 className="gxj-display-title mt-3 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
        {title}
      </h2>
      <div className={`mt-5 text-base leading-relaxed ${dark ? "text-background/80" : ""}`}>
        {children}
      </div>
    </section>
  );
}

export function AcceleratorOfferPage({
  actionLabel,
  actionDisabled = false,
  onAction,
  status,
}: {
  actionLabel: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  status?: ReactNode;
}) {
  const action = (fullWidth = false) => (
    <Button
      type="button"
      size="lg"
      disabled={actionDisabled}
      onClick={onAction}
      className={`gxj-display-title min-h-14 px-6 text-xl uppercase leading-none tracking-wide ${
        fullWidth ? "w-full" : "w-full sm:w-auto"
      }`}
    >
      {actionLabel}
      <ArrowRight className="size-4" />
    </Button>
  );

  return (
    <PlatformPage
      kicker="28-Day Fat Loss Accelerator"
      title="Turn the Next Four Weeks Into a Real Fitness Comeback"
      description="Get a complete jump-rope-led training and nutrition plan for adults 50+ who want to lose fat, rebuild fitness, and are prepared to follow through."
      titleSize="compact"
      contentGap="tight"
    >
      <div className="border-y-2 border-foreground py-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            ["5", "Guided workouts each week"],
            ["24-28", "Minutes per workout"],
            ["$37", "One-time payment"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="gxj-display-title text-3xl uppercase leading-none sm:text-4xl">
                {value}
              </p>
              <p className="mt-2 text-xs font-bold uppercase leading-tight tracking-[0.1em] text-foreground/60 sm:text-sm">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="py-7">
        {action()}
        {status ? <div className="mt-3 text-sm leading-relaxed">{status}</div> : null}
      </div>

      <OfferSection
        kicker="What Usually Goes Wrong"
        title="The Missing Piece Is What Happens After Today"
      >
        <p>
          Most workouts answer one question: what can I do right now? They do not tell you what
          comes tomorrow, how your food supports the goal, or how four weeks of work fit together.
        </p>
        <p className="mt-4">
          That leaves you making the same decisions over and over. A busy day breaks the rhythm. A
          missed workout becomes another restart. The effort is real, but it never has enough
          structure behind it.
        </p>
      </OfferSection>

      <OfferSection kicker="Are You Ready?" title="You Do Not Have to Be Fit Already">
        <ul className="space-y-4">
          {[
            "Give one program an honest four-week commitment.",
            "Complete five guided workouts each week at a pace you control.",
            "Use Nutrition targets instead of relying on exercise alone.",
            "Train independently and return to the next program day when life interrupts you.",
          ].map((item) => (
            <li key={item} className="flex gap-3 font-medium">
              <Check className="mt-0.5 size-5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 font-bold">You still have to bring the effort.</p>
      </OfferSection>

      <OfferSection
        kicker="Four Weeks, Already Mapped Out"
        title="Know What to Do Every Time You Open the App"
      >
        <div className="divide-y border-y border-foreground/15">
          {included.map(([title, copy]) => (
            <div className="py-5" key={title}>
              <h3 className="gxj-display-title text-2xl uppercase leading-none tracking-wide">
                {title}
              </h3>
              <p className="mt-2 text-foreground/75">{copy}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-lg font-bold">
          You are buying one connected system, not more content to sort through on your own.
        </p>
        <div className="mt-6">{action()}</div>
      </OfferSection>

      <OfferSection
        kicker="Same Plan. Better Execution."
        title="Progress Comes From Improving the Work, Not Replacing It"
      >
        <p>
          You do not need 28 unrelated workouts. The core weekly sequence stays familiar so you can
          improve your rhythm, pace, control, and consistency instead of learning a different
          routine every day.
        </p>
        <div className="mt-6 grid border-y border-foreground/15 sm:grid-cols-2">
          {weeks.map(([week, title, copy], index) => (
            <div
              key={week}
              className={`py-5 sm:px-5 ${index > 0 ? "border-t border-foreground/15 sm:border-t-0" : ""} ${
                index % 2 === 1 ? "sm:border-l" : ""
              } ${index > 1 ? "sm:border-t" : ""}`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-foreground/55">
                {week}
              </p>
              <h3 className="gxj-display-title mt-2 text-2xl uppercase leading-none tracking-wide">
                {title}
              </h3>
              <p className="mt-2 text-foreground/75">{copy}</p>
            </div>
          ))}
        </div>
      </OfferSection>

      <OfferSection
        kicker="Simple Moves. Honest Work."
        title="Training and Nutrition Work Together"
        dark
      >
        <p className="text-xl font-bold text-background">
          We are not here to learn tricks. We are here to get fit.
        </p>
        <div className="mt-6 divide-y divide-background/20 border-y border-background/20">
          {[
            [
              "Jump rope builds the conditioning",
              "Train coordination, rhythm, and sustained effort with fundamental jumping.",
            ],
            [
              "Bodyweight training builds the strength",
              "Train the major movement patterns without needing a gym or weights.",
            ],
            [
              "Nutrition creates the fat-loss conditions",
              "Use daily calorie and protein targets instead of trying to out-train the way you eat.",
            ],
          ].map(([title, copy]) => (
            <div className="py-5" key={title}>
              <h3 className="gxj-display-title text-2xl uppercase leading-none tracking-wide text-background">
                {title}
              </h3>
              <p className="mt-2">{copy}</p>
            </div>
          ))}
        </div>
      </OfferSection>

      <OfferSection
        kicker="Why Trust Todd"
        title="I Built the Plan I Wish I Had During My Own Restarts"
      >
        <p>
          I did not invent a fitness system for other people. Gen X Jumps grew from the way I
          changed my own body and the way I continue to train today.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5">
          <figure>
            <img
              src={BEFORE_PHOTO}
              alt="Todd before rebuilding his fitness"
              className="aspect-[4/5] w-full object-cover grayscale"
            />
            <figcaption className="mt-3">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/55">
                Before
              </span>
              <span className="gxj-display-title mt-1 block text-3xl uppercase">235 lb</span>
            </figcaption>
          </figure>
          <figure>
            <img
              src={CURRENT_PHOTO}
              alt="Todd after rebuilding his fitness"
              className="aspect-[4/5] w-full object-cover grayscale"
            />
            <figcaption className="mt-3">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/55">
                Current
              </span>
              <span className="gxj-display-title mt-1 block text-3xl uppercase">175 lb</span>
            </figcaption>
          </figure>
        </div>
        <div className="mt-7 border-y border-foreground/15 py-6">
          <h3 className="gxj-display-title text-3xl uppercase leading-none tracking-wide">
            I Filmed and Lead Every Workout
          </h3>
          <p className="mt-3">
            I am asking you to do work I still do myself. You will train with me, not with a
            collection of videos handed off to someone else.
          </p>
        </div>
        <p className="mt-6 text-xl font-bold">I am training for the long game.</p>
        <p className="mt-2">
          For what I want my body to be able to do next year, ten years from now, and beyond.
        </p>
      </OfferSection>

      <OfferSection kicker="Ready to Commit?" title="Start Your Next 28 Days Today">
        <p>
          Get the complete 28-Day Fat Loss Accelerator for one payment of $37. If it is not right
          for you after experiencing Week 1, request a refund within seven days of purchase.
        </p>
        <p className="gxj-display-title mt-6 text-5xl uppercase leading-none">$37</p>
        <p className="mt-2 font-medium text-foreground/70">
          One payment. No subscription. Access does not expire.
        </p>
        <div className="mt-6">{action()}</div>
        {status ? <div className="mt-3 text-sm leading-relaxed">{status}</div> : null}
      </OfferSection>

      <OfferSection kicker="Before You Decide" title="What You Should Know">
        <div className="divide-y border-y border-foreground/15">
          {faqs.map(([question, answer]) => (
            <details className="group py-5" key={question}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                <span>{question}</span>
                <span className="text-xl group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-2xl text-foreground/75">{answer}</p>
            </details>
          ))}
        </div>
      </OfferSection>

      <section className="-mx-5 bg-foreground px-5 py-9 text-background sm:-mx-8 sm:px-8 sm:py-11">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gxj-aqua">
          Decide What Happens Next
        </p>
        <h2 className="gxj-display-title mt-3 text-4xl uppercase leading-none tracking-wide sm:text-5xl">
          Four Weeks From Now Starts With Day 1
        </h2>
        <p className="mt-5 text-base leading-relaxed text-background/80">
          The program cannot complete the repetitions or make the food choices for you. It can
          remove the uncertainty and give every day of your effort a place to go.
        </p>
        <div className="mt-6">{action(true)}</div>
        <p className="mt-4 text-sm text-background/70">
          One $37 payment. Seven days to experience the first week.
        </p>
      </section>
    </PlatformPage>
  );
}
