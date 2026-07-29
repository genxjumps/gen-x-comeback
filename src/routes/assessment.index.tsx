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
import { migrateQ4 } from "@/lib/plan";

export const Route = createFileRoute("/assessment/")({
  head: () => ({
    meta: [
      { title: "Assessment — Free 7-Day Fitness Plan" },
      {
        name: "description",
        content:
          "Answer a few short questions about your starting point, jump-rope level, physical considerations, and weekly availability.",
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

const STORAGE_KEY = "gxj_assessment_draft_v1";

type Answers = {
  q1: string;
  q2: string;
  q3: string;
  q4: string[];
  q5: string;
  equipment: string[];
  weight: string;
  unit: "lb" | "kg";
};

const emptyAnswers: Answers = {
  q1: "",
  q2: "",
  q3: "",
  q4: [],
  q5: "",
  equipment: [],
  weight: "",
  unit: "lb",
};

const q1Options = [
  { label: "None", value: "none" },
  { label: "1 workout", value: "one" },
  { label: "2-3 workouts", value: "two_three" },
  { label: "4 or more workouts", value: "four_plus" },
];

const q2Options = [
  { label: "I\u2019m coming back after a long break", value: "long_break" },
  { label: "I\u2019ve been inconsistent", value: "inconsistent" },
  { label: "I\u2019m already active and need a clear plan", value: "active_needs_plan" },
];

const q3Options = [
  { label: "I don\u2019t have a rope", value: "no_rope" },
  { label: "I\u2019m brand new", value: "new" },
  { label: "I can jump in short bursts", value: "short_bursts" },
  { label: "I\u2019m comfortable jumping rope", value: "comfortable" },
];

const q4Options = [
  { label: "Knees", value: "knees" },
  { label: "Shoulders", value: "shoulders" },
  { label: "Elbows", value: "elbows" },
  { label: "Wrists", value: "wrists" },
  { label: "Low back", value: "low_back" },
  { label: "Balance", value: "balance" },
  { label: "Getting down to or up from the floor", value: "floor_access" },
  { label: "I need to limit impact or jumping", value: "limit_impact" },
  { label: "None of these", value: "none" },
];

const q5Options = [
  { label: "3 days", value: "3" },
  { label: "4 days", value: "4" },
  { label: "5 days", value: "5" },
  { label: "6-7 days", value: "6_7" },
];

const equipmentOptions = [
  { label: "Jump rope", value: "jump_rope" },
  { label: "Dumbbells", value: "dumbbells" },
  { label: "Exercise or jump rope mat", value: "mat" },
  { label: "Rubber gym flooring", value: "rubber_flooring" },
  { label: "None of these", value: "none" },
];

function weightError(answers: Answers): string | null {
  const raw = answers.weight.trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Enter a number or leave this blank.";
  if (answers.unit === "lb" && (n < 70 || n > 700)) return "Enter a weight between 70 and 700 lb.";
  if (answers.unit === "kg" && (n < 32 || n > 318)) return "Enter a weight between 32 and 318 kg.";
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
        {error ? <p className="mt-2 text-xs font-medium text-foreground">{error}</p> : null}
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
      // TEMPORARY TESTING UTILITY: ?reset=1 clears the saved draft and starts fresh.
      // Remove this before production launch.
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset") === "1") {
        window.localStorage.removeItem(STORAGE_KEY);
        params.delete("reset");
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", newUrl);
        setAnswers(emptyAnswers);
        setStep(1);
        setLoaded(true);
        return;
      }

      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Answers> & { step?: number };
        setAnswers({
          ...emptyAnswers,
          ...parsed,
          q4: migrateQ4(parsed.q4),
          equipment: parsed.equipment ?? [],
        });
        if (parsed.step && parsed.step >= 1 && parsed.step <= 3) setStep(parsed.step);
      }
    } catch {
      /* ignore malformed draft */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...answers, step }));
    } catch {
      /* storage unavailable */
    }
  }, [answers, step, loaded]);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const toggleQ4 = (value: string, checked: boolean) => {
    setAnswers((prev) => {
      if (!checked) return { ...prev, q4: prev.q4.filter((v) => v !== value) };
      if (value === "none") return { ...prev, q4: ["none"] };
      return { ...prev, q4: [...prev.q4.filter((v) => v !== "none"), value] };
    });
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

  const onContinue = () => {
    if (!stageValid) {
      setShowErrors(true);
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
            ? "Jump Rope and Movement Limits"
            : "Your Workout Schedule and Protein Target"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {step === 1
          ? "Your answers will help me choose the best starting level for your personalized 7-day fitness plan."
          : step === 2
            ? "Your answers will help me choose the right workout combinations and impact level for your personalized 7-day fitness plan."
            : "Your answers will help me build a realistic weekly workout schedule and calculate a practical daily protein target."}
      </p>

      <div className="mt-6 space-y-4">
        {step === 1 ? (
          <>
            <Question
              heading="How many structured workouts did you complete in the last seven days?"
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
              heading="Which best describes where you are right now?"
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
              heading="What best describes your jump-rope level?"
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
              heading="Do any of these affect how you exercise right now?"
              hint="Select all that apply."
              error={
                showErrors && answers.q4.length === 0
                  ? "Select at least one option, or choose None of these."
                  : null
              }
            >
              <div className="grid gap-2">
                {q4Options.map((o) => (
                  <Label
                    key={o.value}
                    htmlFor={`q4-${o.value}`}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-normal leading-snug has-[[data-state=checked]]:border-foreground"
                  >
                    <Checkbox
                      id={`q4-${o.value}`}
                      checked={answers.q4.includes(o.value)}
                      onCheckedChange={(c) => toggleQ4(o.value, c === true)}
                    />
                    <span>{o.label}</span>
                  </Label>
                ))}
              </div>
            </Question>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Question
              heading="How many days can you realistically do one of these short workouts this week?"
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
              heading="Current weight"
              hint="Optional. This is used only to make the protein guidance more useful. It does not change your workout plan."
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
        <Button type="button" className="flex-1" onClick={onContinue} disabled={!stageValid}>
          {step === 3 ? "Continue to Plan Details" : "Continue"}
        </Button>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Temporary checkpoint behavior: your draft answers are saved only in this browser using local
        storage. No account, database, or server storage is connected yet.
      </p>
    </div>
  );
}
