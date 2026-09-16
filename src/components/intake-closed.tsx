import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function IntakeClosed() {
  return (
    <section className="py-7 sm:py-10">
      <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">Plan Access</p>
      <h1 className="gxj-display-title mt-4 text-3xl uppercase leading-[0.95] tracking-wide sm:text-4xl">
        Pick Up Where You Left Off
      </h1>
      <p className="mt-3 max-w-lg text-base font-medium leading-relaxed text-foreground/80">
        Get a secure access link to your 7-Day Comeback Plan or any Gen X Jumps program you own.
      </p>
      <div className="mt-6">
        <Button
          asChild
          size="lg"
          className="gxj-display-title min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto"
        >
          <Link to="/recover">Get My Access Link</Link>
        </Button>
        <p className="mt-3 text-sm text-foreground/65">No password needed.</p>
      </div>
    </section>
  );
}
