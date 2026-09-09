import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { InstallExperience, type InstallEventName } from "@/components/pwa-install";
import { AccessDenied } from "@/components/plan-access";
import { readStoredToken } from "@/lib/access-token";
import { getPlanHub, recordOnboardingEvent } from "@/lib/lead.functions";
import type { PlanHubData } from "@/lib/lead-plan";
import { installPlatform, isStandaloneDisplay, type InstallPlatform } from "@/lib/pwa-install";

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

  const track = useCallback(
    (eventName: InstallEventName, platform: InstallPlatform) => {
      void saveEvent({
        data: { token: readStoredToken(), eventName, platform },
      }).catch(() => undefined);
    },
    [saveEvent],
  );

  useEffect(() => {
    let active = true;
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
  if (status === "denied" || !plan) return <AccessDenied />;

  return (
    <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-2xl place-items-center px-5 py-8 sm:py-12">
      <section className="w-full">
        <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
          Your Plan Is Ready
        </p>
        <h1 className="gxj-display-title mt-4 text-3xl leading-[1.05] tracking-tight sm:text-4xl">
          {plan.firstName}, Keep Your Comeback One Tap Away
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          Your personalized seven-day plan is saved and ready. Add Gen X Jumps to your Home Screen
          so it&rsquo;s easy to come back for every workout.
        </p>
        <div className="mt-7">
          <InstallExperience
            track={track}
            onContinue={() => navigate({ to: "/your-plan", replace: true })}
          />
        </div>
      </section>
    </div>
  );
}
