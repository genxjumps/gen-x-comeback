import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSESSMENT_STORAGE_KEY,
  EQUIPMENT_VALUES,
  Q1_VALUES,
  Q2_VALUES,
  Q3_VALUES,
  Q4_VALUES,
  Q5_VALUES,
  WEIGHT_BOUNDS,
  emptyAnswers,
  migrateQ4,
  type Answers,
} from "@/lib/plan";

export const Route = createFileRoute("/assessment/")({
  head: () => ({
    meta: [
      { title: "Assessment — Free 7-Day Fitness Plan" },
      {
        name: "description",
        content:
          "Answer a few short questions about your starting point, jump rope experience, impact needs, and weekly availability.",
      },
      { property: "og:title", content: "Assessment — Free 7-Day Fitness Plan" },
      {
        property: "og:description",
        content:
          "Three short stages that shape your personalized 7-day workout and protein plan.",
      },
    ],
  }),
  component: Assessment,
});



const q1Options = [
  { label: "None", value: Q1_VALUES[0] },
  { label: "1 workout", value: Q1_VALUES[1] },
  { label: "2-3 workouts", value: Q1_VALUES[2] },
  { label: "4 or more workouts", value: Q1_VALUES[3] },
];

const q2Options = [
  { label: "I\u2019m coming back after a long break", value: Q2_VALUES[0] },
  { label: "I\u2019ve been active, but inconsistent", value: Q2_VALUES[1] },
  { label: "I\u2019m already active and need a clear plan", value: Q2_VALUES[2] },
];

// Legacy Q3_VALUES[1] ("no_rope") is accepted in saved drafts but never rendered.
const q3Options = [
  { label: "I\u2019ve never jumped rope", value: Q3_VALUES[0] },
  { label: "I\u2019m new to jumping rope", value: Q3_VALUES[2] },
  { label: "I can jump for short periods", value: Q3_VALUES[3] },
  { label: "I\u2019m comfortable jumping rope", value: Q3_VALUES[4] },
];

const q4Options = [
  { label: "No", value: Q4_VALUES[0] },
  { label: "Yes", value: Q4_VALUES[1] },
];

const q5Options = [
  { label: "3 days", value: Q5_VALUES[0] },
  { label: "4 days", value: Q5_VALUES[1] },
  { label: "5 days", value: Q5_VALUES[2] },
  { label: "6-7 days", value: Q5_VALUES[3] },
];

const equipmentOptions = [
  { label: "Jump rope", value: EQUIPMENT_VALUES[0] },
  { label: "Dumbbells", value: EQUIPMENT_VALUES[1] },
  { label: "Exercise or jump rope mat", value: EQUIPMENT_VALUES[2] },
  { label: "Rubber gym flooring", value: EQUIPMENT_VALUES[3] },
  { label: "None of these", value: EQUIPMENT_VALUES[4] },
];

function weightError(answers: Answers): string | null {
  const raw = answers.weight.trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Enter a number or leave this blank.";
  const { lb, kg } = WEIGHT_BOUNDS;
  if (answers.unit === "lb" && (n < lb.min || n > lb.max))
    return `Enter a weight between ${lb.min} and ${lb.max} lb.`;
  if (answers.unit === "kg" && (n < kg.min || n > kg.max))
    return `Enter a weight between ${kg.min} and ${kg.max} kg.`;
  return null;
}

function Question({
  heading,
  hint,
  error,
  children,
}: {
  heading: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 sm:p-5">
        <h2 className="text-sm font-medium leading-snug">{heading}</h2>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
        <div className="mt-3">{children}</div>
        <div aria-live="polite" role="status">
          {error ? <p className="mt-2 text-xs font-medium text-foreground">{error}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SingleSelect({
  value,
  onChange,
  options,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  name: string;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="gap-2">
      {options.map((o) => (
        <Label
          key={o.value}
          htmlFor={`${name}-${o.value}`}
          className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-normal leading-snug has-[[data-state=checked]]:border-foreground"
        >
          <RadioGroupItem id={`${name}-${o.value}`} value={o.value} />
          <span>{o.label}</span>
        </Label>
      ))}
    </RadioGroup>
  );
}

function Assessment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [loaded, setLoaded] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ASSESSMENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Answers> & { step?: number };
        const { step: _savedStep, ...savedAnswers } = parsed;
        const rawQ4 = Array.isArray(parsed.q4) ? parsed.q4 : [];
        const q4 = migrateQ4(rawQ4);
        setAnswers({
          ...emptyAnswers,
          ...savedAnswers,
          q4,
          equipment: parsed.equipment ?? [],
        });
        // Prefilled answers are restored, but the flow always begins at Step 1 and
        // advances one stage per Continue press. The saved step is intentionally ignored.
      }
    } catch {
      /* ignore malformed draft */
    }
    setLoaded(true);
  }, []);


  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify({ ...answers, step }));
    } catch {
      /* storage unavailable */
    }
  }, [answers, step, loaded]);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };


  const toggleEquipment = (value: string, checked: boolean) => {
    setAnswers((prev) => {
      if (!checked) return { ...prev, equipment: prev.equipment.filter((v) => v !== value) };
      if (value === "none") return { ...prev, equipment: ["none"] };
      return { ...prev, equipment: [...prev.equipment.filter((v) => v !== "none"), value] };
    });
  };

  const wError = weightError(answers);

  const stageValid =
    step === 1
      ? Boolean(answers.q1) && Boolean(answers.q2)
      : step === 2
        ? Boolean(answers.q3) && answers.q4.length > 0
        : Boolean(answers.q5) && answers.equipment.length > 0 && !wError;

  /** Moves keyboard focus to the first invalid control on the current stage. */
  const focusFirstInvalid = () => {
    const targets: string[] =
      step === 1
        ? [answers.q1 ? "" : `#q1-${q1Options[0].value}`, answers.q2 ? "" : `#q2-${q2Options[0].value}`]
        : step === 2
          ? [
              answers.q3 ? "" : `#q3-${q3Options[0].value}`,
              answers.q4.length > 0 ? "" : `#q4-${q4Options[0].value}`,
            ]
          : [
              answers.equipment.length > 0 ? "" : `#equipment-${equipmentOptions[0].value}`,
              answers.q5 ? "" : `#q5-${q5Options[0].value}`,
              wError ? "#weight" : "",
            ];
    const selector = targets.find((s) => s !== "");
    if (!selector) return;
    window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(selector);
      el?.focus();
    });
  };

  const onContinue = () => {
    if (!stageValid) {
      setShowErrors(true);
      focusFirstInvalid();
      return;
    }
    setShowErrors(false);
    if (step < 3) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
    } else {
      navigate({ to: "/assessment/complete" });
    }
  };

  const onBack = () => {
    setShowErrors(false);
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo({ top: 0 });
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Step {step} of 3
      </p>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((s) => (
          <span
            key={s}
            className={`h-1 flex-1 rounded-full ${s <= step ? "bg-foreground" : "bg-muted"}`}
          />
        ))}
      </div>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight">
        {step === 1
          ? "Your Starting Point"
          : step === 2
            ? "Jump Rope and Impact"
            : "Your Workout Schedule and Protein Target"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {step === 1
          ? "Your answers will help me choose the best starting level for your personalized 7-day fitness plan."
          : step === 2
            ? "Your answers will help me choose the right jump rope guidance and impact level for your personalized 7-day fitness plan."
            : "Your answers will help me build a realistic weekly workout schedule and calculate a practical daily protein target."}
      </p>

      <div className="mt-6 space-y-4">
        {step === 1 ? (
          <>
            <Question
              heading="How many structured workouts did you complete in the past seven days?"
              error={showErrors && !answers.q1 ? "Select one option to continue." : null}
            >
              <SingleSelect
                name="q1"
                value={answers.q1}
                onChange={(v) => set("q1", v)}
                options={q1Options}
              />
            </Question>
            <Question
              heading="Which statement best describes where you are with exercise right now?"
              error={showErrors && !answers.q2 ? "Select one option to continue." : null}
            >
              <SingleSelect
                name="q2"
                value={answers.q2}
                onChange={(v) => set("q2", v)}
                options={q2Options}
              />
            </Question>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Question
              heading={"What\u2019s your current jump rope experience?"}
              error={showErrors && !answers.q3 ? "Select one option to continue." : null}
            >
              <SingleSelect
                name="q3"
                value={answers.q3}
                onChange={(v) => set("q3", v)}
                options={q3Options}
              />
            </Question>
            <Question
              heading="Do you need to limit jumping or use a lower-impact option during workouts?"
              error={
                showErrors && answers.q4.length === 0 ? "Select one option to continue." : null
              }
            >
              <SingleSelect
                name="q4"
                value={answers.q4[0] ?? ""}
                onChange={(v) => set("q4", [v])}
                options={q4Options}
              />
            </Question>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Question
              heading="Which of these do you regularly have access to for your workouts?"
              hint="Select all that apply."
              error={
                showErrors && answers.equipment.length === 0
                  ? "Select at least one option, or choose None of these."
                  : null
              }
            >
              <div className="grid gap-2">
                {equipmentOptions.map((o) => (
                  <Label
                    key={o.value}
                    htmlFor={`equipment-${o.value}`}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-normal leading-snug has-[[data-state=checked]]:border-foreground"
                  >
                    <Checkbox
                      id={`equipment-${o.value}`}
                      checked={answers.equipment.includes(o.value)}
                      onCheckedChange={(c) => toggleEquipment(o.value, c === true)}
                    />
                    <span>{o.label}</span>
                  </Label>
                ))}
              </div>
            </Question>
            <Question
              heading="How many days per week can you realistically and consistently complete a short workout?"
              error={showErrors && !answers.q5 ? "Select one option to continue." : null}
            >
              <SingleSelect
                name="q5"
                value={answers.q5}
                onChange={(v) => set("q5", v)}
                options={q5Options}
              />
            </Question>
            <Question
              heading="Current weight"
              hint={"Optional. I\u2019ll use this only to calculate a more accurate daily protein target. It will not change your workout plan."}
              error={wError}
            >
              <div className="flex gap-2">
                <Input
                  id="weight"
                  inputMode="decimal"
                  type="number"
                  placeholder="Optional"
                  aria-label="Current weight"
                  value={answers.weight}
                  onChange={(e) => set("weight", e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={answers.unit}
                  onValueChange={(v) => set("unit", v as "lb" | "kg")}
                >
                  <SelectTrigger className="w-24" aria-label="Weight unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lb">lb</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Question>
          </>
        ) : null}
      </div>

      <div className="mt-6 flex items-center gap-3">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link to="/">Back</Link>
          </Button>
        )}
        <Button type="button" className="flex-1" onClick={onContinue}>
          {step === 3 ? "Get My 7-Day Fitness Plan" : "Continue"}
        </Button>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Your answers are saved in this browser while you complete the assessment. After you submit
        your name and email, your plan and progress are saved so you can return to them.
      </p>
    </div>
  );
}
