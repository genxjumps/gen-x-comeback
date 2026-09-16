import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function IntakeClosed() {
  return (
    <section className="py-10 sm:py-16">
      <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">Free 7-Day Plan</p>
      <h1 className="gxj-display-title mt-5 text-5xl uppercase leading-[0.94] tracking-wide sm:text-7xl">
        Prove You&rsquo;re Not Done Yet
      </h1>
      <p className="mt-5 max-w-xl text-lg font-medium leading-relaxed">
        Get a simple jump rope, strength, and nutrition plan built around what you can do right now.
      </p>

      <div className="mt-8 border-l-4 border-primary pl-4">
        <p className="gxj-display-title text-2xl uppercase tracking-wide">Opening Soon</p>
        <p className="mt-1 max-w-xl text-base leading-relaxed text-foreground/75">
          The free 7-Day Comeback Plan isn&rsquo;t available to new participants yet.
        </p>
      </div>

      <section className="mt-10 border-t border-foreground/15 py-6 sm:py-8">
        <h2 className="gxj-display-title mb-4 text-2xl uppercase tracking-wide sm:text-3xl">
          Built for a real comeback
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {["Short workouts", "Simple food targets", "Options for your joints"].map((item) => (
            <p key={item} className="border-t-2 border-foreground pt-3 font-bold">
              {item}
            </p>
          ))}
        </div>
      </section>

      <section className="border-t border-foreground/15 pt-6 sm:pt-8">
        <h2 className="text-base font-bold">Already have a plan?</h2>
        <p className="mt-1 max-w-xl text-base leading-relaxed text-foreground/75">
          Get a fresh secure access link and pick up where you left off.
        </p>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="gxj-display-title mt-5 min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto"
        >
          <Link to="/recover">Recover My Plan</Link>
        </Button>
      </section>
    </section>
  );
}
