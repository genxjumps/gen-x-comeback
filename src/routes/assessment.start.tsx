import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

function BeforeYouStart() {
  const navigate = useNavigate();
  const [answer, setAnswer] = useState("");
  const [ineligible, setIneligible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ELIGIBILITY_STORAGE_KEY);
      if (stored && options.some((o) => o.value === stored)) setAnswer(stored);
    } catch {
      // ignore
    }
  }, []);

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

  if (ineligible) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
        <h1 className="gxj-display-title text-2xl tracking-tight sm:text-3xl">Before You Start</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This plan is not designed for rehabilitation, chair-based exercise, assisted exercise, or
          people who cannot complete basic exercise independently.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button asChild variant="outline">
            <Link to="/">Back to start</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setIneligible(false)}>
            Change my answer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <h1 className="gxj-display-title text-2xl tracking-tight sm:text-3xl">Before You Start</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This plan is for adults ranging from deconditioned to fit who can exercise independently.
      </p>

      <div className="mt-6">
        <Card className="border-border">
          <CardContent className="p-4 sm:p-5">
            <h2 className="text-sm font-medium leading-snug">
              Can you safely exercise on your own, including standing, walking, getting down to and
              up from the floor, and performing simple bodyweight movements?
            </h2>
            <div className="mt-3">
              <RadioGroup value={answer} onValueChange={onAnswerChange} className="gap-2">
                {options.map((o) => (
                  <Label
                    key={o.value}
                    htmlFor={`eligibility-${o.value}`}
                    className="gxj-choice flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-normal leading-snug"
                  >
                    <RadioGroupItem id={`eligibility-${o.value}`} value={o.value} />
                    <span>{o.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button asChild variant="outline">
          <Link to="/">Back</Link>
        </Button>
        <Button type="button" className="flex-1" onClick={onContinue} disabled={!answer}>
          Continue
        </Button>
      </div>
    </div>
  );
}
