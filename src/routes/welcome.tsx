import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IntakeClosed } from "@/components/intake-closed";
import { getLeadIntakeWelcome } from "@/lib/lead-intake.functions";
import type { LeadIntakeWelcomeResult } from "@/lib/lead-intake.functions";
import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome - Build Your 7-Day Comeback Plan | Gen X Jumps" },
      {
        name: "description",
        content: "Your access is saved. Complete the quick setup to build your 7-Day Plan.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LeadWelcome,
});

const steps = [
  { label: "Access saved", state: "complete" },
  { label: "Quick setup", state: "current" },
  { label: "Plan ready", state: "upcoming" },
] as const;

function LeadWelcome() {
  const loadWelcome = useServerFn(getLeadIntakeWelcome);
  const [result, setResult] = useState<LeadIntakeWelcomeResult | null>(null);

  useEffect(() => {
    let active = true;
    void loadWelcome({ data: {} })
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setResult({ ok: false, reason: "missing_or_expired" });
      });
    return () => {
      active = false;
    };
  }, [loadWelcome]);

  if (!NEW_PLAN_INTAKE_OPEN) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
        <IntakeClosed />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-2xl place-items-center px-5 py-8">
        <p className="text-sm text-muted-foreground" role="status">
          Opening your setup...
        </p>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-xl place-items-center px-5 py-8">
        <section className="w-full rounded-lg border border-border bg-card p-5 sm:p-7">
          <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
            Let&rsquo;s Try That Again
          </p>
          <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight">
            We Couldn&rsquo;t Find Your Signup
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your secure setup may have expired or this browser may have blocked it. Return to the
            website and submit the short form again.
          </p>
          <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
            <a href="https://genxjumps.com/start-here/">Return to My Signup</a>
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-2xl place-items-center px-5 py-8 sm:py-12">
      <section className="w-full">
        <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
          You&rsquo;re In
        </p>
        <h1 className="gxj-display-title mt-4 text-3xl leading-[1.05] tracking-tight sm:text-4xl">
          {result.firstName}, Let&rsquo;s Build Your Comeback Plan
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          We saved your access. Answer a few quick questions about your fitness, schedule,
          equipment, and limitations. Then we&rsquo;ll build your personalized seven-day plan
          immediately.
        </p>

        <ol className="mt-7 grid gap-2 sm:grid-cols-3" aria-label="Plan setup progress">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className={`flex items-center gap-3 rounded-md border p-3 ${
                step.state === "complete"
                  ? "border-gxj-teal bg-gxj-mint"
                  : step.state === "current"
                    ? "border-foreground bg-card"
                    : "border-border bg-muted/30"
              }`}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  step.state === "complete"
                    ? "bg-gxj-teal text-white"
                    : "border border-border bg-background"
                }`}
              >
                {step.state === "complete" ? (
                  <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                ) : step.state === "current" ? (
                  index + 1
                ) : (
                  <Circle aria-hidden="true" className="size-3 fill-muted text-muted" />
                )}
              </span>
              <span className="text-sm font-semibold">{step.label}</span>
            </li>
          ))}
        </ol>

        <div className="mt-7">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/assessment/start">Build My 7-Day Plan</Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            About 2 minutes. No password required.
          </p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Once your plan is ready, we&rsquo;ll help you add Gen X Jumps to your Home Screen so
            your workouts are always one tap away.
          </p>
        </div>
      </section>
    </div>
  );
}
