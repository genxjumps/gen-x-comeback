import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";

import { AppLoadingState, AppStatePanel } from "@/components/precision-surfaces";
import { SetupProgress } from "@/components/setup-progress";
import { Button } from "@/components/ui/button";
import { getLeadIntakeWelcome } from "@/lib/lead-intake.functions";
import type { LeadIntakeWelcomeResult } from "@/lib/lead-intake.functions";
import { bindSignupDraft, signupDraftDestination } from "@/lib/signup-draft";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/lead-plan";
import { readStoredToken, clearStoredToken } from "@/lib/access-token";
import { isVisualReviewMode } from "@/lib/visual-review";

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

function LeadWelcome() {
  const navigate = useNavigate();
  const [destination, setDestination] = useState<"/assessment/start" | "/assessment">(
    "/assessment/start",
  );
  const loadWelcome = useServerFn(getLeadIntakeWelcome);
  const [result, setResult] = useState<LeadIntakeWelcomeResult | null>(null);

  useEffect(() => {
    let active = true;
    if (isVisualReviewMode()) {
      bindSignupDraft("visual-review");
      setDestination(signupDraftDestination());
      setResult({ ok: true, state: "setup", firstName: "Todd", draftKey: "visual-review" });
      return () => {
        active = false;
      };
    }
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
        <AppLoadingState label="Opening your setup" className="w-full max-w-md" />
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-xl place-items-center px-5 py-8">
        <AppStatePanel
          state="error"
          title="We Couldn't Find Your Signup"
          description="Your secure setup may have expired or this browser may have blocked it. Return to the website and submit the short form again."
          action={
            <Button asChild>
              <a href="https://genxjumps.com/start-here/">Return to My Signup</a>
            </Button>
          }
          className="w-full"
        />
      </div>
    );
  }

  if (result.state !== "setup")
    return (
      <div className="gxj-page mx-auto min-h-[calc(100svh-9rem)] w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
        <header className="py-6 sm:py-8">
          <div className="mx-auto max-w-2xl text-center">
            <div
              className="mx-auto mb-6 grid size-12 place-items-center rounded-[var(--pu-radius-contained)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)]"
              aria-hidden="true"
            >
              <Mail className="size-6 text-[var(--pu-action-primary)]" strokeWidth={2} />
            </div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Check Your Email</h1>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-[var(--pu-text-secondary)]">
              Use your secure welcome link to continue with your saved plan. Your progress stays
              saved.
            </p>
            <p className="mt-3 text-sm text-[var(--pu-text-secondary)]">
              If it hasn't arrived, check spam or request another link.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl border-t border-[var(--pu-border-subtle)] pt-5 text-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href="https://genxjumps.com/start-here/#seven-day-optin">Request Another Link</a>
          </Button>
        </div>
      </div>
    );

  return (
    <div className="gxj-page mx-auto min-h-[calc(100svh-9rem)] w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
      <header className="py-6 sm:py-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-action-primary)]">
            Congratulations
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
            {result.firstName}, Let&rsquo;s Build Your Comeback Plan
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--pu-text-secondary)]">
            Answer a few quick questions about your fitness, schedule, equipment, and any
            limitations. Then we&rsquo;ll build your personalized 7-day plan immediately.
          </p>
        </div>
      </header>

      <div className="max-w-3xl">
        <SetupProgress currentStep={2} label="Plan setup progress" />
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pu-text-secondary)]">
          <span>Access saved</span>
          <span className="text-[var(--pu-action-primary)]">Quick setup</span>
          <span>Plan ready</span>
        </div>
      </div>

      <div className="mt-7 max-w-3xl border-t border-[var(--pu-border-subtle)] pt-5">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to={destination}>Create My 7-Day Plan</Link>
        </Button>
        <p className="mt-3 text-sm text-[var(--pu-text-secondary)]">
          About 2 minutes. No password required.
        </p>
      </div>
    </div>
  );
}
