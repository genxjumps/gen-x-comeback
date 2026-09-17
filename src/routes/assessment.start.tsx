import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { IntakeClosed } from "@/components/intake-closed";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNewPlanIntakeAccess } from "@/lib/use-new-plan-intake-access";

export const Route = createFileRoute("/assessment/start")({
  head: () => ({
    meta: [
      { title: "Before You Start — Free 7-Day Fitness Plan" },
      {
        name: "description",
        content:
          "A quick eligibility check before the assessment: confirm you can exercise independently.",
      },
      { property: "og:title", content: "Before You Start — Free 7-Day Fitness Plan" },
      {
        property: "og:description",
        content:
          "A quick eligibility check before the assessment: confirm you can exercise independently.",
      },
    ],
  }),
  component: BeforeYouStart,
});

const options = [
  { label: "Yes", value: "yes" },
  { label: "Yes, with minor modifications", value: "yes_modified" },
  { label: "No", value: "no" },
];

const ELIGIBILITY_STORAGE_KEY = "gxj_eligibility_answer_v1";
const ACTION_CLASS = "gxj-display-title min-h-14 px-6 text-xl uppercase leading-none tracking-wide";

function BeforeYouStart() {
  const navigate = useNavigate();
  const intakeAccess = useNewPlanIntakeAccess();
  const [answer, setAnswer] = useState("");
  const [ineligible, setIneligible] = useState(false);

  useEffect(() => {
    if (intakeAccess !== "allowed") return;
    try {
      const stored = window.localStorage.getItem(ELIGIBILITY_STORAGE_KEY);
      if (stored && options.some((o) => o.value === stored)) setAnswer(stored);
    } catch {
      // ignore
    }
  }, [intakeAccess]);

  const onAnswerChange = (value: string) => {
    setAnswer(value);
    try {
      window.localStorage.setItem(ELIGIBILITY_STORAGE_KEY, value);
    } catch {
      // ignore
    }
  };

  const onContinue = () => {
    if (answer === "no") {
      setIneligible(true);
      window.scrollTo({ top: 0 });
      return;
    }
    navigate({ to: "/assessment" });
  };

  if (intakeAccess === "checking") {
    return (
      <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-2xl place-items-center px-5 py-8">
        <p className="text-sm text-muted-foreground" role="status">
          Opening your setup...
        </p>
      </div>
    );
  }

  if (intakeAccess === "closed") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
        <IntakeClosed />
      </div>
    );
  }

  if (ineligible) {
    return (
      <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
        <header className="py-6 sm:py-8">
          <div className="max-w-2xl">
            <h1 className="gxj-display-title text-3xl uppercase leading-none tracking-wide sm:text-4xl">
              I’m Sorry
            </h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-foreground/75">
              This plan is not designed for rehabilitation, chair-based exercise, assisted exercise,
              or people who cannot complete basic exercise independently.
            </p>
          </div>
        </header>

        <div className="mx-auto mt-1 flex max-w-3xl flex-col-reverse gap-3 border-t border-foreground/20 pt-5 sm:flex-row sm:justify-between">
          <Button asChild variant="outline" className={ACTION_CLASS}>
            <Link to="/">Back to start</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className={ACTION_CLASS}
            onClick={() => setIneligible(false)}
          >
            Change my answer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
      <header className="py-6 sm:py-8">
        <div className="max-w-2xl">
          <h1 className="gxj-display-title text-3xl uppercase leading-none tracking-wide sm:text-4xl">
            Before You Start
          </h1>
          <p className="mt-3 text-base font-medium leading-relaxed text-foreground/75">
            You don&rsquo;t need to be in great shape. You just need to be able to exercise safely
            on your own.
          </p>
        </div>
      </header>

      <section className="border-t-2 border-foreground/20 py-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-bold leading-snug sm:text-2xl">
            Can you safely jump rope, get down to and up from the floor, and do basic bodyweight
            exercises like push-ups, squats, and lunges on your own?
          </h2>
          <RadioGroup value={answer} onValueChange={onAnswerChange} className="mt-5 gap-3">
            {options.map((o) => (
              <Label
                key={o.value}
                htmlFor={`eligibility-${o.value}`}
                className="gxj-choice gxj-option-card cursor-pointer text-base font-semibold leading-snug"
              >
                <RadioGroupItem
                  id={`eligibility-${o.value}`}
                  value={o.value}
                  className="size-5 shrink-0 border-2 border-foreground/35 text-gxj-orange data-[state=checked]:border-gxj-orange data-[state=checked]:text-gxj-orange [&_svg]:size-2.5"
                />
                <span className="gxj-assessment-choice-label">{o.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </section>

      <div className="mx-auto mt-1 flex max-w-3xl items-stretch gap-3 border-t border-foreground/20 pt-5">
        <Button asChild variant="outline" className={ACTION_CLASS}>
          <Link to="/">Back</Link>
        </Button>
        <Button
          type="button"
          className={`${ACTION_CLASS} flex-1`}
          onClick={onContinue}
          disabled={!answer}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
