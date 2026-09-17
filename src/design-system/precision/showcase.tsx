import { Check, Dumbbell, Info, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import {
  PuButton,
  PuContainer,
  PuEyebrow,
  PuField,
  PuHeading,
  PuNav,
  PuNotice,
  PuPanel,
  PuProgress,
  PuRadioChoice,
  PuReadingWidth,
  PuSection,
  PuShell,
  PuText,
} from "./components";

const navItems = ["Home", "Programs", "Progress", "Nutrition"] as const;

export function PrecisionUtilityShowcase() {
  const [days, setDays] = useState("4");

  return (
    <PuShell>
      <PuContainer className="py-8 sm:py-12">
        <header className="border-b border-[var(--pu-border-strong)] pb-8">
          <PuEyebrow>Gen X Jumps Design System</PuEyebrow>
          <PuReadingWidth className="mt-3">
            <PuHeading level={1} hero>
              Precision Utility
            </PuHeading>
            <PuText tone="body" className="mt-4 max-w-2xl">
              Production component showcase. These are real isolated components built from the
              approved foundations, not screenshots of existing app pages.
            </PuText>
          </PuReadingWidth>
        </header>

        <PuSection>
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <div>
              <PuText tone="meta">Typography</PuText>
              <PuText tone="support" className="mt-2">
                Barlow carries the interface. Anton is reserved for later brand-impact moments.
              </PuText>
            </div>
            <PuPanel strong className="space-y-6">
              <div>
                <PuEyebrow>Today</PuEyebrow>
                <PuHeading level={1} className="mt-2">
                  Jump Rope + Full Body
                </PuHeading>
              </div>
              <PuHeading level={2}>Current Program</PuHeading>
              <PuHeading level={3}>Protein Target</PuHeading>
              <PuText tone="body">
                Clear 16px body copy is the default reading size across the app.
              </PuText>
              <PuText tone="support">
                Supporting text is quieter but remains fully readable.
              </PuText>
              <PuText tone="meta">Week 2 · Day 9 of 28</PuText>
            </PuPanel>
          </div>
        </PuSection>

        <PuSection>
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <div>
              <PuText tone="meta">Actions</PuText>
              <PuText tone="support" className="mt-2">
                One system for major, standard and compact controls.
              </PuText>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PuButton size="major">Start My 7-Day Plan</PuButton>
              <PuButton>Start Workout</PuButton>
              <PuButton variant="secondary">View Program</PuButton>
              <PuButton variant="quiet">Not Now</PuButton>
              <PuButton variant="secondary" size="compact">
                Edit
              </PuButton>
              <PuButton disabled>Disabled</PuButton>
            </div>
          </div>
        </PuSection>

        <PuSection>
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <div>
              <PuText tone="meta">Forms + choices</PuText>
              <PuText tone="support" className="mt-2">
                Questions stay on the page. Interactive controls get boundaries.
              </PuText>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <PuPanel>
                <PuField
                  id="showcase-weight"
                  label="Current weight"
                  help="Use your current weight, not your goal weight."
                  inputProps={{ inputMode: "decimal", placeholder: "180 lb" }}
                />
              </PuPanel>
              <PuPanel>
                <PuHeading level={3}>How many days can you train?</PuHeading>
                <div className="mt-4 grid gap-2">
                  {["3", "4", "5"].map((value) => (
                    <PuRadioChoice
                      key={value}
                      name="training-days"
                      value={value}
                      label={`${value} days per week`}
                      checked={days === value}
                      onChange={() => setDays(value)}
                    />
                  ))}
                </div>
              </PuPanel>
            </div>
          </div>
        </PuSection>

        <PuSection>
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <div>
              <PuText tone="meta">Progress</PuText>
              <PuText tone="support" className="mt-2">
                Compact, obvious, and subordinate to the task.
              </PuText>
            </div>
            <PuPanel>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <PuText tone="meta">Step 2 of 4</PuText>
                  <PuHeading level={3} className="mt-1">
                    Training availability
                  </PuHeading>
                </div>
                <PuText tone="support">50%</PuText>
              </div>
              <PuProgress currentStep={2} steps={4} label="Setup progress: step 2 of 4" className="mt-4" />
            </PuPanel>
          </div>
        </PuSection>

        <PuSection>
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <div>
              <PuText tone="meta">Status states</PuText>
              <PuText tone="support" className="mt-2">
                Color supports meaning. Text carries meaning.
              </PuText>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <PuNotice tone="info">
                <div className="flex gap-3">
                  <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <div>
                    <PuHeading level={3}>Accelerator context</PuHeading>
                    <PuText tone="support" className="mt-1">
                      Aqua is a bounded program accent, not a second primary action color.
                    </PuText>
                  </div>
                </div>
              </PuNotice>
              <PuNotice tone="success">
                <div className="flex gap-3">
                  <Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <div>
                    <PuHeading level={3}>Workout complete</PuHeading>
                    <PuText tone="support" className="mt-1">
                      Completion is confirmed in text as well as color.
                    </PuText>
                  </div>
                </div>
              </PuNotice>
              <PuNotice tone="warning">
                <div className="flex gap-3">
                  <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <div>
                    <PuHeading level={3}>Action needed</PuHeading>
                    <PuText tone="support" className="mt-1">
                      Review this setting before continuing.
                    </PuText>
                  </div>
                </div>
              </PuNotice>
              <PuNotice tone="danger" role="alert">
                <div className="flex gap-3">
                  <X className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <div>
                    <PuHeading level={3}>Couldn’t save</PuHeading>
                    <PuText tone="support" className="mt-1">
                      Try again. Your previous value is still intact.
                    </PuText>
                  </div>
                </div>
              </PuNotice>
            </div>
          </div>
        </PuSection>

        <PuSection>
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <div>
              <PuText tone="meta">Navigation</PuText>
              <PuText tone="support" className="mt-2">
                Persistent destinations use one restrained utility treatment.
              </PuText>
            </div>
            <PuPanel>
              <PuNav items={navItems} current="Programs" label="Showcase primary navigation" />
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  ["Programs", "2 programs"],
                  ["Progress", "Waist: 34 in"],
                  ["Nutrition", "195 g protein"],
                ].map(([title, detail]) => (
                  <div key={title} className="border-t border-[var(--pu-border-strong)] py-4">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="size-4" aria-hidden="true" />
                      <PuHeading level={3}>{title}</PuHeading>
                    </div>
                    <PuText tone="support" className="mt-1">
                      {detail}
                    </PuText>
                  </div>
                ))}
              </div>
            </PuPanel>
          </div>
        </PuSection>

        <footer className="border-t border-[var(--pu-border-strong)] py-8">
          <PuText tone="meta">Component-system review only · no production route migration</PuText>
        </footer>
      </PuContainer>
    </PuShell>
  );
}
