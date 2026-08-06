import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cardioGuidance, ropeLevelFromExperience, type CardioContext } from "@/lib/lead-plan";
import { answersSchema } from "@/lib/lead-schemas";
import { readAnswers } from "@/lib/plan";
import {
  W01_APPROACH,
  W01_DURATION,
  W01_EQUIPMENT_NOTES,
  W01_EXPECT,
  W01_IFRAME_SRC,
  W01_RUNDOWN,
  W01_TITLE,
} from "@/lib/w01-content";

// Pre-opt-in Day 1 playback. Requires a complete local assessment draft, never a
// saved-plan access token, and never writes leads, plans, tokens, or progress.
export const Route = createFileRoute("/preview/w01")({
  head: () => ({
    meta: [
      { title: "Day 1 - Full Body Flush & Fire | Gen X Jumps" },
      {
        name: "description",
        content:
          "Your Day 1 workout preview: about 15 minutes of short jump rope intervals mixed with sumo squats, push-ups, and seated core work.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Day 1 - Full Body Flush & Fire | Gen X Jumps" },
      {
        property: "og:description",
        content:
          "Your Day 1 workout preview: about 15 minutes of short jump rope intervals mixed with sumo squats, push-ups, and seated core work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DayOnePreviewPage,
});

function DayOnePreviewPage() {
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [cardio, setCardio] = useState<CardioContext | null>(null);

  useEffect(() => {
    const answers = readAnswers();
    const parsed = answersSchema.safeParse(answers);
    if (!parsed.success) {
      setStatus("denied");
      return;
    }
    const a = parsed.data;
    setCardio({
      impactLimited: a.q4.includes("limit_impact"),
      ownsRope: a.equipment.includes("jump_rope"),
      ropeLevel: ropeLevelFromExperience(a.q3),
    });
    setStatus("allowed");
  }, []);

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <p className="text-sm text-muted-foreground">Loading your Day 1 workout...</p>
      </div>
    );
  }

  if (status === "denied" || !cardio) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Finish Your Assessment First
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Day 1 is matched to your answers, and we could not find a completed assessment in this
          browser.
        </p>
        <div className="mt-6 grid gap-3 sm:flex">
          <Button asChild className="w-full sm:w-auto">
            <Link to="/assessment/start">Build My 7-Day Plan</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/assessment">Continue My Assessment</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <Link
        to="/assessment/complete"
        className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to My Results
      </Link>

      <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Day 1
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {W01_TITLE}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">{W01_DURATION}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{W01_RUNDOWN}</p>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          What to Expect
        </h2>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {W01_EXPECT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="mt-6 aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        <iframe
          src={W01_IFRAME_SRC}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
          title="W01 - Full Body Flush & Fire"
        />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Your Cardio Option
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {cardioGuidance(cardio)}
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          How to Approach This Workout
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{W01_APPROACH}</p>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Equipment
        </h2>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {W01_EQUIPMENT_NOTES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Progress tracking is saved after you unlock your full plan.
        </p>
        <Button asChild size="lg" className="mt-3 w-full sm:w-auto">
          <Link to="/assessment/complete">Unlock and Save My Full Plan</Link>
        </Button>
      </section>
    </div>
  );
}
