import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { InstallExperience, type InstallEventName } from "@/components/pwa-install";
import { AccessDenied } from "@/components/plan-access";
import { readStoredToken } from "@/lib/access-token";
import { getPlanHub, recordOnboardingEvent } from "@/lib/lead.functions";
import type { PlanHubData } from "@/lib/lead-plan";
import { installPlatform, isStandaloneDisplay, type InstallPlatform } from "@/lib/pwa-install";
import { isVisualReviewMode } from "@/lib/visual-review";

export const Route = createFileRoute("/plan-ready")({
  head: () => ({
    meta: [
      { title: "Your 7-Day Plan Is Ready | Gen X Jumps" },
      {
        name: "description",
        content: "Keep your Gen X Jumps plan one tap away by adding it to your Home Screen.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PlanReady,
});

function PlanReady() {
  const navigate = useNavigate();
  const loadPlan = useServerFn(getPlanHub);
  const saveEvent = useServerFn(recordOnboardingEvent);
  const [status, setStatus] = useState<"loading" | "ready" | "denied">("loading");
  const [plan, setPlan] = useState<PlanHubData | null>(null);
  const [visualReview, setVisualReview] = useState(false);

  const track = useCallback(
    (eventName: InstallEventName, platform: InstallPlatform) => {
      if (isVisualReviewMode()) return;
      void saveEvent({
        data: { token: readStoredToken(), eventName, platform },
      }).catch(() => undefined);
    },
    [saveEvent],
  );

  useEffect(() => {
    let active = true;
    if (isVisualReviewMode()) {
      setVisualReview(true);
      setStatus("ready");
      return;
    }
    if (isStandaloneDisplay()) {
      track("installed_display_detected", installPlatform());
      navigate({ to: "/your-plan", replace: true });
      return;
    }
    void loadPlan({ data: { token: readStoredToken() } })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setPlan(result.data);
          setStatus("ready");
        } else setStatus("denied");
      })
      .catch(() => {
        if (active) setStatus("denied");
      });
    return () => {
      active = false;
    };
  }, [loadPlan, navigate, track]);

  if (status === "loading") {
    return (
      <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-2xl place-items-center px-5 py-8">
        <p className="text-sm text-muted-foreground" role="status">
          Opening your plan...
        </p>
      </div>
    );
  }
  if (status === "denied" || (!plan && !visualReview)) return <AccessDenied />;

  return (
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
      <section className="max-w-2xl py-6 sm:py-8">
        <p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">
          Your Plan Is Ready
        </p>
        <h1 className="gxj-display-title mt-4 text-3xl uppercase leading-none tracking-wide sm:text-4xl">
          {visualReview ? "Todd" : plan!.firstName}, Keep Your Comeback One Tap Away
        </h1>
        <div className="mt-3">
          <InstallExperience
            track={track}
            onContinue={() =>
              navigate({ to: visualReview ? "/preview/w01" : "/your-plan", replace: true })
            }
          />
        </div>
      </section>
    </div>
  );
}
