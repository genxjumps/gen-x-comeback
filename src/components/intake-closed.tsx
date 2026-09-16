import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function IntakeClosed() {
  return (
    <section className="py-6 sm:py-8">
      <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">
        7-Day Comeback Plan
      </p>
      <h1 className="gxj-display-title mt-4 max-w-2xl text-3xl uppercase leading-none tracking-wide sm:text-4xl">
        The 7-Day Comeback Plan Is Almost Ready
      </h1>
      <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-foreground/75">
        I&rsquo;m finishing the experience before opening it publicly. New plans aren&rsquo;t
        available right now.
      </p>
      <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-foreground/75">
        Already have a plan? Use your access email or request a fresh secure link.
      </p>
      <div className="mt-6 border-t border-foreground/20 pt-5">
        <Button
          asChild
          size="lg"
          className="gxj-display-title min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto"
        >
          <Link to="/recover">Recover My Plan</Link>
        </Button>
      </div>
    </section>
  );
}
