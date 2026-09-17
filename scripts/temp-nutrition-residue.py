from pathlib import Path

route_path = Path("src/routes/nutrition.tsx")
text = route_path.read_text()

def rep(old, new, count=None):
    global text
    if old not in text:
        raise SystemExit(f"Missing expected Nutrition source fragment:\n{old[:220]}")
    text = text.replace(old, new, -1 if count is None else count)

rep('import { ExternalLink, Info, RotateCcw, ShieldCheck } from "lucide-react";',
    'import { ExternalLink, Info, RotateCcw } from "lucide-react";')
rep('import { PlatformPage } from "@/components/platform-page";\n',
    'import { PlatformPage } from "@/components/platform-page";\nimport { AppLoadingState, AppNotice, AppStatePanel } from "@/components/precision-surfaces";\n')
rep('import { Button } from "@/components/ui/button";\n',
    'import { Button } from "@/components/ui/button";\nimport { Checkbox } from "@/components/ui/checkbox";\n')

rep('className="size-5 shrink-0 border-2 border-foreground/35 text-gxj-orange data-[state=checked]:border-gxj-orange data-[state=checked]:text-gxj-orange [&_svg]:size-2.5"',
    'className="size-5 shrink-0 [&_svg]:size-2.5"')
rep('className="border-t-2 border-foreground/20 py-6 sm:py-8"',
    'className="border-t border-[var(--pu-border-subtle)] py-6 sm:py-8"')
text = text.replace('text-sm leading-relaxed text-muted-foreground',
                    'text-sm leading-relaxed text-[var(--pu-text-secondary)]')

old_target = '''function TargetCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-32 flex-col justify-center border-b border-r border-foreground/25 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="gxj-display-title mt-3 text-xl uppercase leading-[0.95] tracking-wide sm:text-2xl">
        {value}
      </p>
    </div>
  );
}'''
new_target = '''function TargetCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-4 sm:py-0 sm:px-4 first:sm:pl-0 last:sm:pr-0">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{value}</p>
    </div>
  );
}'''
rep(old_target, new_target)

rep('className="gxj-display-title min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto"',
    'className="w-full sm:w-auto"')

anchor = 'htmlFor={choiceId("meal", occasion)}'
pos = text.find(anchor)
if pos < 0:
    raise SystemExit("Missing meal-choice anchor")
start = text.rfind("<Label", 0, pos)
end_marker = "</Label>"
end = text.find(end_marker, pos)
if start < 0 or end < 0:
    raise SystemExit("Could not bound meal-choice label")
end += len(end_marker)
indent = "                  "
new_meals = '''<Label
  key={occasion}
  htmlFor={choiceId("meal", occasion)}
  className="gxj-choice gxj-option-card cursor-pointer text-base font-semibold leading-snug"
>
  <Checkbox
    id={choiceId("meal", occasion)}
    checked={selected}
    onCheckedChange={(checked) => toggleMeal(occasion, checked === true)}
  />
  <span className="gxj-assessment-choice-label">{mealLabels[occasion]}</span>
</Label>'''
new_meals = "\n".join(indent + line if line else line for line in new_meals.splitlines())
text = text[:start] + new_meals + text[end:]

old_stop = '''          <div aria-live="polite">
            {stopped ? (
              <p className="border-l-4 border-gxj-orange py-2 pl-4 text-sm font-medium">
                These inputs need an individualized nutrition target. Work with a registered
                dietitian instead of using this calculator.
              </p>
            ) : error ? (
              <p className="border-l-4 border-gxj-orange py-2 pl-4 text-sm font-medium">{error}</p>
            ) : null}
          </div>'''
new_stop = '''          <div aria-live="polite">
            {stopped ? (
              <AppNotice tone="warning">
                These inputs need an individualized nutrition target. Work with a registered
                dietitian instead of using this calculator.
              </AppNotice>
            ) : error ? (
              <AppNotice tone="danger">{error}</AppNotice>
            ) : null}
          </div>'''
rep(old_stop, new_stop)

text = text.replace('border-t border-foreground/20', 'border-t border-[var(--pu-border-subtle)]')
text = text.replace('border-b border-foreground/15', 'border-b border-[var(--pu-border-subtle)]')
text = text.replace('divide-y divide-foreground/15 border-y border-foreground/15',
                    'divide-y divide-[var(--pu-border-subtle)] border-y border-[var(--pu-border-subtle)]')
text = text.replace('divide-x divide-foreground/15', 'divide-x divide-[var(--pu-border-subtle)]')
rep('grid grid-cols-2 border-l border-t border-foreground/25 sm:grid-cols-4',
    'grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--pu-border-subtle)] py-5 sm:grid-cols-4 sm:divide-x sm:divide-[var(--pu-border-subtle)]')
text = text.replace('rounded-md border border-border bg-muted/30 p-3',
                    'rounded-[var(--pu-radius-control)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-subtle)] p-3')
text = text.replace('rounded-md bg-muted/50 p-3 text-base leading-relaxed',
                    'rounded-[var(--pu-radius-control)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-subtle)] p-3 text-base leading-relaxed')
text = text.replace('text-xs font-semibold uppercase tracking-[0.14em] text-gxj-teal',
                    'text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-accent-program)]')
text = text.replace('accent-gxj-teal', 'accent-[var(--pu-accent-program)]')
text = text.replace('gxj-display-title mt-2 text-2xl uppercase tracking-wide sm:text-3xl',
                    'mt-2 text-2xl font-extrabold leading-tight sm:text-3xl')
text = text.replace('gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl',
                    'text-2xl font-extrabold leading-tight sm:text-3xl')
text = text.replace('gxj-display-title text-xl uppercase tracking-wide sm:text-2xl',
                    'text-xl font-bold leading-tight sm:text-2xl')
text = text.replace('gxj-display-title translate-y-1 text-xl uppercase tracking-wide sm:text-2xl',
                    'text-sm font-bold text-[var(--pu-text-secondary)]')
text = text.replace('gxj-display-title text-xl uppercase leading-none tracking-wide sm:text-2xl',
                    'text-xl font-extrabold leading-none sm:text-2xl')
text = text.replace('border border-gxj-teal/40 bg-gxj-mint',
                    'border border-[var(--pu-border-subtle)] bg-[var(--pu-accent-program-tint)]')

text = text.replace('className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 font-semibold transition-colors hover:bg-muted/35"',
                    'className="mt-5 flex items-center justify-between gap-4 border-y border-[var(--pu-border-subtle)] py-5 font-semibold transition-colors hover:bg-[var(--pu-surface-subtle)]"')
text = text.replace('className="gxj-display-title block text-xl uppercase tracking-wide sm:text-2xl"',
                    'className="block text-lg font-bold sm:text-xl"')

old_states = '''  if (!result) return <p className="text-sm text-muted-foreground">Loading your nutrition...</p>;
  if (!result.ok) {
    return (
      <PlatformPage
        kicker="Your Nutrition"
        title="Nutrition Couldn't Be Loaded"
        description="We couldn't confirm your account or load your saved nutrition targets. Nothing was changed."
      >
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => {
            setResult(null);
            setLoadAttempt((attempt) => attempt + 1);
          }}
        >
          Try Again
        </Button>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Still not working?{" "}
          <Link
            to="/recover"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            Sign in again.
          </Link>
        </p>
      </PlatformPage>
    );
  }
  if (result.access === "locked") {
    return (
      <PlatformPage
        kicker="Your Nutrition"
        title="Simple Targets That Fit Your Plan"
        description="Nutrition guidance unlocks with an eligible paid program."
      >
        <section className="border-t border-foreground/15 py-6 first:border-t-0 first:pt-0 sm:py-8">
          <div className="text-center">
            <ShieldCheck className="mx-auto size-8" />
            <h2 className="gxj-display-title mt-4 text-3xl uppercase">Not Unlocked</h2>
            <p className="mt-2 text-muted-foreground">
              Included with the 28-Day Fat Loss Accelerator.
            </p>
          </div>
        </section>
        <Button asChild>
          <Link to="/my-programs" hash="available">
            Explore the Accelerator
          </Link>
        </Button>
      </PlatformPage>
    );
  }'''
new_states = '''  if (!result) {
    return (
      <PlatformPage title="Your Nutrition" titleSize="compact">
        <AppLoadingState label="Loading your nutrition" />
      </PlatformPage>
    );
  }
  if (!result.ok) {
    return (
      <PlatformPage
        kicker="Your Nutrition"
        title="Nutrition Couldn't Be Loaded"
        description="We couldn't confirm your account or load your saved nutrition targets. Nothing was changed."
      >
        <AppStatePanel
          state="error"
          title="Try again"
          description="Your saved nutrition information was not changed."
          action={
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => {
                  setResult(null);
                  setLoadAttempt((attempt) => attempt + 1);
                }}
              >
                Try Again
              </Button>
              <Button asChild variant="outline">
                <Link to="/recover">Sign in again.</Link>
              </Button>
            </div>
          }
        />
        <p className="mt-4 text-sm text-[var(--pu-text-secondary)]">Still not working?</p>
      </PlatformPage>
    );
  }
  if (result.access === "locked") {
    return (
      <PlatformPage
        kicker="Your Nutrition"
        title="Simple Targets That Fit Your Plan"
        description="Nutrition guidance unlocks with an eligible paid program."
      >
        <AppStatePanel
          state="locked"
          title="Not Unlocked"
          description="Included with the 28-Day Fat Loss Accelerator."
          action={
            <Button asChild>
              <Link to="/my-programs" hash="available">
                Explore the Accelerator
              </Link>
            </Button>
          }
        />
      </PlatformPage>
    );
  }'''
rep(old_states, new_states)
route_path.write_text(text)

test_path = Path("src/lib/__tests__/app-review.test.ts")
tests = test_path.read_text()
tests = tests.replace('for (const source of [activeNutritionReviewSource, nutritionResultsSource]) {',
                      'for (const source of [activeNutritionReviewSource]) {', 1)
tests = tests.replace('for (const source of [activeNutritionReviewSource, nutritionRouteSource]) {',
                      'for (const source of [activeNutritionReviewSource]) {', 1)

anchor_test = '''    expect(nutritionRouteSource).toContain('? "Your Nutrition"');'''
insert = '''    expect(nutritionResultsSource).toContain("text-2xl font-extrabold leading-tight sm:text-3xl");
    expect(nutritionResultsSource).toContain("border-b border-[var(--pu-border-subtle)]");
    expect(nutritionResultsSource).toContain("grid grid-cols-2 gap-x-6 gap-y-5 border-y");
    expect(nutritionResultsSource).toContain("text-sm font-bold text-[var(--pu-text-secondary)]");
    expect(nutritionResultsSource).not.toContain("gxj-display-title");
    expect(nutritionRouteSource).toContain("<AppNotice tone=\"warning\"");
    expect(nutritionRouteSource).toContain("<AppStatePanel");
    expect(nutritionRouteSource).toContain("<AppLoadingState");
    expect(nutritionRouteSource).toContain("<Checkbox");
    expect(nutritionRouteSource).not.toContain("ShieldCheck");
''' + anchor_test
if anchor_test not in tests:
    raise SystemExit("Missing Nutrition test insertion anchor")
tests = tests.replace(anchor_test, insert, 1)

old_locked = '''  it("centers only the Nutrition locked-status block", () => {
    for (const source of [nutritionReviewSource, nutritionRouteSource]) {
      expect(source).toContain("Simple Targets That Fit Your Plan");
      expect(source).toContain("Included with the 28-Day Fat Loss Accelerator.");
      expect(source).toContain('<div className="text-center">');
      expect(source).toContain('className="mx-auto size-8"');
      expect(source).toContain("Explore the Accelerator");
    }
    expect(nutritionReviewSource).not.toContain('<Page className="text-center"');
    expect(nutritionRouteSource).not.toContain('<PlatformPage className="text-center"');
  });'''
new_locked = '''  it("uses the approved Nutrition locked state", () => {
    expect(nutritionReviewSource).toContain("Simple Targets That Fit Your Plan");
    expect(nutritionReviewSource).toContain("Included with the 28-Day Fat Loss Accelerator.");
    expect(nutritionRouteSource).toContain("Simple Targets That Fit Your Plan");
    expect(nutritionRouteSource).toContain("Included with the 28-Day Fat Loss Accelerator.");
    expect(nutritionRouteSource).toContain("<AppStatePanel");
    expect(nutritionRouteSource).toContain('state="locked"');
    expect(nutritionRouteSource).toContain("Explore the Accelerator");
    expect(nutritionRouteSource).not.toContain("ShieldCheck");
  });'''
if old_locked not in tests:
    raise SystemExit("Missing old Nutrition locked-state test")
tests = tests.replace(old_locked, new_locked, 1)
tests = tests.replace('expect(nutritionRouteSource).toContain("border-t-2 border-foreground/20 py-6 sm:py-8");',
                      'expect(nutritionRouteSource).toContain("border-t border-[var(--pu-border-subtle)] py-6 sm:py-8");', 1)
test_path.write_text(tests)

state_path = Path("CURRENT_STATE.md")
state = state_path.read_text()
old = '''- Complete the remaining Precision Utility route-specific residue after the shared primitives are in
  place. Nutrition and smaller participant history/completion/install surfaces remain after the core
  participant-route cleanup checkpoint.'''
new = '''- Complete the remaining Precision Utility route-specific residue after the shared primitives are in
  place. Smaller participant history/completion/install surfaces remain after Nutrition is migrated.'''
if old not in state:
    raise SystemExit("Missing CURRENT_STATE open-work block")
state = state.replace(old, new, 1)

old2 = '''Precision Utility route-specific residue cleanup is the active design checkpoint. The current
bounded checkpoint removes legacy one-off presentation from Home, Progress, and Notifications while
preserving their product behavior. Home now follows the approved heading and row hierarchy, Progress
uses compact shared linear progress and lighter structure, and Notifications uses shared list/state
surfaces instead of card-by-default presentation. Nutrition remains the next bounded residue surface
because its setup and results views are materially larger and should not be mixed into this commit.'''
new2 = '''Precision Utility route-specific residue cleanup is the active design checkpoint. The current
bounded checkpoint migrates Nutrition setup and results presentation onto the approved system while
preserving calculator logic, saved drafts, target math, access gating, sliders, and server behavior.
Nutrition now uses shared states/notices/choices, restrained heading hierarchy, thin structural rules,
and direct target stats. Smaller participant history/completion/install surfaces remain next.'''
if old2 not in state:
    raise SystemExit("Missing CURRENT_STATE active checkpoint block")
state_path.write_text(state.replace(old2, new2, 1))
