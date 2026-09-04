import { useState } from "react";
import { ArrowRight, Check, Play, Video } from "lucide-react";

import { AcceleratorProgramPreview } from "@/components/accelerator-program-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PreviewScreen = "home" | "programs" | "setup" | "daily" | "progress" | "completion";

const SCREENS: Array<{ id: PreviewScreen; label: string }> = [
  { id: "home", label: "Home" },
  { id: "programs", label: "My Programs" },
  { id: "setup", label: "Setup" },
  { id: "daily", label: "Today’s Workout" },
  { id: "progress", label: "Progress" },
  { id: "completion", label: "Day 28 Complete" },
];

function PreviewPage({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">{kicker}</p>
      <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {description}
      </p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function HomePreview({ openDaily }: { openDaily: () => void }) {
  return (
    <PreviewPage
      kicker="Welcome Back, Todd"
      title="Today’s Comeback Starts Here"
      description="Your next workout stays first. Everything else is easy to find without turning Home into a content feed."
    >
      <section className="rounded-lg border border-border bg-gxj-mint p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
          Today’s Workout
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Day 15: Workout A</h2>
        <p className="mt-2 text-sm text-muted-foreground">14 of 28 days complete</p>
        <Button type="button" className="mt-5" onClick={openDaily}>
          Open Today’s Workout
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </section>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["My Programs", "Owned programs and previous runs"],
          ["Your Progress", "Latest measurements and history"],
          ["Your Nutrition", "Guidance and targets"],
          ["Explore Programs", "Find the next structured program"],
        ].map(([title, description]) => (
          <section key={title} className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </section>
        ))}
      </div>
    </PreviewPage>
  );
}

function ProgramsPreview({ openSetup }: { openSetup: () => void }) {
  return (
    <PreviewPage
      kicker="My Programs"
      title="Your Programs, In One Place"
      description="Programs stay here without erasing completed work or previous runs."
    >
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-muted">
            <Play aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
              Not Started
            </p>
            <h2 className="mt-1 text-lg font-semibold">28-Day Fat Loss Accelerator</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Owned for life. Start when you’re ready.
            </p>
            <Button type="button" className="mt-4" onClick={openSetup}>
              Start Program
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </section>
      <section className="mt-4 rounded-lg border border-border bg-card p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
          Completed
        </p>
        <h2 className="mt-1 text-lg font-semibold">7-Day Comeback Plan</h2>
        <p className="mt-2 text-sm text-muted-foreground">7 of 7 days complete</p>
      </section>
    </PreviewPage>
  );
}

function SetupPreview({ begin }: { begin: () => void }) {
  return (
    <PreviewPage
      kicker="Program Setup"
      title="Start Your 28-Day Accelerator"
      description="Watch the welcome, choose optional starting measurements, and explicitly begin Day 1."
    >
      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Welcome From Todd</h2>
        <div className="mt-4 flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/60">
          <div className="text-center">
            <Video aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Orientation video placeholder</p>
          </div>
        </div>
      </section>
      <section className="mt-4 rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Starting Measurements</h2>
        <p className="mt-2 text-sm text-muted-foreground">Both are optional.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="preview-weight">Weight - lb</Label>
            <Input id="preview-weight" className="mt-2" placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="preview-waist">Waist - in</Label>
            <Input id="preview-waist" className="mt-2" placeholder="Optional" />
          </div>
        </div>
      </section>
      <Button type="button" size="lg" className="mt-6 w-full" onClick={begin}>
        Begin Day 1
      </Button>
    </PreviewPage>
  );
}

function ProgressPreview() {
  const [details, setDetails] = useState(false);
  return (
    <PreviewPage
      kicker="Your Progress"
      title="See The Work Adding Up"
      description="The everyday view stays simple. Detailed history is available only when you ask for it."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Current Program", "14 of 28 days"],
          ["Latest Weight", "184 lb"],
          ["Latest Waist", "36.5 in"],
        ].map(([label, value]) => (
          <section key={label} className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-lg font-semibold">{value}</p>
          </section>
        ))}
      </div>
      <section className="mt-5 rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Measurements</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Weight and waist are independent and optional.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setDetails((open) => !open)}>
            {details ? "Hide Detailed History" : "View Detailed History"}
          </Button>
        </div>
        {details ? (
          <div className="mt-5 divide-y divide-border rounded-md bg-muted/40 px-4">
            {[
              ["Weight", "190 lb", "Starting"],
              ["Waist", "38 in", "Starting"],
              ["Weight", "184 lb", "Progress"],
              ["Waist", "36.5 in", "Progress"],
            ].map(([kind, value, context], index) => (
              <div key={`${kind}-${index}`} className="flex justify-between py-3 text-sm">
                <span className="font-semibold">
                  {kind} - {value}
                </span>
                <span className="text-muted-foreground">{context}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </PreviewPage>
  );
}

export function AcceleratorFlowPreview() {
  const [screen, setScreen] = useState<PreviewScreen>("home");
  return (
    <main>
      <section className="border-b border-border bg-muted/40 px-5 py-4 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2">
            <Check aria-hidden="true" className="size-4 text-gxj-teal" />
            <p className="text-xs font-semibold">Internal no-save preview</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Switch screens or use the main action buttons. Nothing is connected or saved.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SCREENS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={screen === item.id ? "default" : "outline"}
                onClick={() => setScreen(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </section>
      {screen === "home" ? <HomePreview openDaily={() => setScreen("daily")} /> : null}
      {screen === "programs" ? <ProgramsPreview openSetup={() => setScreen("setup")} /> : null}
      {screen === "setup" ? <SetupPreview begin={() => setScreen("daily")} /> : null}
      {screen === "daily" ? <AcceleratorProgramPreview initialCompleted={14} /> : null}
      {screen === "progress" ? <ProgressPreview /> : null}
      {screen === "completion" ? <AcceleratorProgramPreview initialCompleted={28} /> : null}
    </main>
  );
}
