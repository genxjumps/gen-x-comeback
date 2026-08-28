import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function IntakeClosed() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h1 className="gxj-display-title text-2xl leading-tight tracking-tight sm:text-3xl">
        The 7-Day Comeback Plan Is Almost Ready
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        I&rsquo;m finishing the experience before opening it publicly. New plans aren&rsquo;t
        available right now.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Already have a plan? Use your access email or request a fresh secure link.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/recover">Recover My Plan</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Back to Start</Link>
        </Button>
      </div>
    </section>
  );
}
