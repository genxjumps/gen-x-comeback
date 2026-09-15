import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getLeadIntakeWelcome } from "@/lib/lead-intake.functions";
import type { LeadIntakeWelcomeResult } from "@/lib/lead-intake.functions";
import { bindSignupDraft, signupDraftDestination } from "@/lib/signup-draft";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/lead-plan";
import { readStoredToken, clearStoredToken } from "@/lib/access-token";

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
  { number: 1, label: "Access saved", state: "complete" },
  { number: 2, label: "Quick setup", state: "current" },
  { number: 3, label: "Plan ready", state: "upcoming" },
] as const;

function LeadWelcome() {
  const navigate = useNavigate();
  const [destination, setDestination] = useState<"/assessment/start" | "/assessment">(
    "/assessment/start",
  );
  const loadWelcome = useServerFn(getLeadIntakeWelcome);
  const [result, setResult] = useState<LeadIntakeWelcomeResult | null>(null);

  useEffect(() => {
    let active = true;
    void loadWelcome({ data: { token: readStoredToken() } })
      .then((value) => {
        if (!active) return;
        if (value.ok && value.state === "plan") {
          if (value.useCookie) clearStoredToken();
          navigate({
            to: "/your-plan",
            hash: value.platformAuthTokenHash
              ? `gxj_auth=${encodeURIComponent(value.platformAuthTokenHash)}`
              : undefined,
            replace: true,
          });
          return;
        }
        if (value.ok && value.state === "setup") {
          bindSignupDraft(value.draftKey);
          setDestination(signupDraftDestination());
        }
        setResult(value);
      })
      .catch(() => {
        if (active) setResult({ ok: false, reason: "missing_or_expired" });
      });
    return () => {
      active = false;
    };
  }, [loadWelcome, navigate]);

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

  if (result.state !== "setup")
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-12">
        <h1 className="gxj-display-title text-3xl">Check Your Email</h1>
        <p className="mt-4">
          Use your secure welcome link to continue with your saved plan. Your progress stays saved.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          If it hasn't arrived, check spam or request another link.
        </p>
        <Button asChild className="mt-6">
          <a href="https://genxjumps.com/start-here/#seven-day-optin">Request Another Link</a>
        </Button>
      </div>
    );

  return (
    <div className="gxj-page mx-auto min-h-[calc(100svh-9rem)] w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
      <header className="py-6 sm:py-8">
        <div className="max-w-2xl">
          <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">
            Congratulations
          </p>
          <h1 className="gxj-display-title mt-4 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
            {result.firstName}, Let&rsquo;s Build Your Comeback Plan
          </h1>
          <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-foreground/75">
            Answer a few quick questions about your fitness, schedule, equipment, and any
            limitations. Then we&rsquo;ll build your personalized 7-day plan immediately.
          </p>
        </div>
      </header>

      <ol className="grid max-w-3xl grid-cols-3 gap-2" aria-label="Plan setup progress">
        {steps.map((step) => (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className={`flex min-h-24 flex-col justify-between gap-4 p-3 sm:min-h-28 sm:p-4 ${
              step.state === "complete"
                ? "bg-foreground text-background"
                : step.state === "current"
                  ? "bg-gxj-orange text-white shadow-[3px_3px_0_color-mix(in_oklch,var(--color-foreground)_18%,transparent)]"
                  : "border-2 border-foreground/20 text-foreground/35"
            }`}
          >
            <span className="gxj-display-title text-2xl leading-none tracking-wide sm:text-3xl">
              {String(step.number).padStart(2, "0")}
            </span>
            <span className="text-xs font-bold uppercase leading-tight tracking-[0.08em] sm:text-sm">
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-7 max-w-3xl border-t border-foreground/20 pt-5">
        <Button
          asChild
          size="lg"
          className="gxj-display-title min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto"
        >
          <Link to={destination}>Create My 7-Day Plan</Link>
        </Button>
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          About 2 minutes. No password required.
        </p>
      </div>
    </div>
  );
}
