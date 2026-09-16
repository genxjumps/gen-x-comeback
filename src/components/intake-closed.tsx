import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

const planBenefits = [
  {
    title: "A Clear 7-Day Schedule",
    body: "Guided workouts, recovery days, and exactly what to do next.",
  },
  {
    title: "Workouts Scaled to You",
    body: "Options based on your rope experience, equipment, and joints.",
  },
  {
    title: "A Practical Protein Target",
    body: "A daily number that supports fat loss, muscle, and recovery.",
  },
];

const planSteps = [
  ["01", "Answer a few short questions about where you are right now."],
  ["02", "Get a complete seven-day workout, recovery, and protein plan."],
  ["03", "Open Day 1 and follow the plan one day at a time."],
];

export function IntakeClosed() {
  return (
    <section className="py-7 sm:py-10">
      <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">Free 7-Day Plan</p>
      <h1 className="gxj-display-title mt-4 text-3xl uppercase leading-[0.95] tracking-wide sm:text-4xl">
        Start Where You Are. Know What to Do Next.
      </h1>
      <p className="mt-3 max-w-lg text-base font-medium leading-relaxed text-foreground/80">
        Get a personalized workout and protein plan built around your current fitness, schedule,
        equipment, and whether you need a lower-impact option.
      </p>

      <section className="mt-8 border-y border-foreground/15 py-6 sm:mt-10 sm:py-8">
        <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
          Your Plan Includes
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {planBenefits.map(({ title, body }) => (
            <div key={title} className="border-t-2 border-foreground pt-3">
              <h3 className="font-bold leading-snug">{title}</h3>
              <p className="mt-2 text-base leading-relaxed text-foreground/70">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-foreground/15 py-6 sm:py-8">
        <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
          How It Works
        </h2>
        <div className="mt-5 divide-y divide-foreground/15 border-y border-foreground/15">
          {planSteps.map(([number, line]) => (
            <div key={number} className="grid grid-cols-[3rem_1fr] items-center gap-4 py-4">
              <span className="gxj-display-title text-2xl leading-none">{number}</span>
              <p className="text-base font-medium leading-relaxed">{line}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pt-6 sm:pt-8">
        <h2 className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl">
          Already Have a Plan?
        </h2>
        <p className="mt-2 max-w-lg text-base leading-relaxed text-foreground/75">
          Get a fresh secure access link and pick up where you left off.
        </p>
        <Button
          asChild
          size="lg"
          className="gxj-display-title mt-5 min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto"
        >
          <Link to="/recover">Get My Access Link</Link>
        </Button>
      </section>
    </section>
  );
}
