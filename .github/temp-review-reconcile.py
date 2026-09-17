from pathlib import Path


def required(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    if old not in text:
        raise SystemExit(f"Missing required fragment: {label}")
    return text.replace(old, new, count)


# Allow production Precision Utility choice primitives to render rich review labels without
# changing their existing behavior or markup.
components_path = Path("src/design-system/precision/components.tsx")
components = components_path.read_text()
radio_anchor = '''export function PuRadioChoice({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;'''
radio_replacement = '''export function PuRadioChoice({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: ReactNode;'''
components = required(components, radio_anchor, radio_replacement, "PuRadioChoice label type")
checkbox_anchor = '''export function PuCheckboxChoice({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;'''
checkbox_replacement = '''export function PuCheckboxChoice({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: ReactNode;'''
components = required(
    components, checkbox_anchor, checkbox_replacement, "PuCheckboxChoice label type"
)
components_path.write_text(components)


# Replace review-only lookalike primitives with production Precision Utility primitives.
review_path = Path("src/components/app-review-screen.tsx")
review = review_path.read_text()
import_anchor = 'import { PlatformPage } from "@/components/platform-page";\n'
review = required(
    review,
    import_anchor,
    import_anchor
    + '''import {
  PuCheckboxChoice,
  PuEyebrow,
  PuHeading,
  PuRadioChoice,
  PuSection,
} from "@/design-system/precision/components";
''',
    "review Precision Utility imports",
)
start = review.find("function Section(")
end = review.find("function Page(", start)
if start < 0 or end < 0:
    raise SystemExit("Could not bound review helper primitives")
new_helpers = '''function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <PuSection className="first:border-t-0 first:pt-0">
      {title ? (
        <PuHeading level={2} className="mb-4">
          {title}
        </PuHeading>
      ) : null}
      {children}
    </PuSection>
  );
}

function Status({ children }: { children: ReactNode }) {
  return <PuEyebrow>{children}</PuEyebrow>;
}

function Action({ children, outline = false }: { children: ReactNode; outline?: boolean }) {
  return (
    <Button type="button" variant={outline ? "outline" : "default"} size="lg">
      {children}
    </Button>
  );
}

function Choice({ children, selected = false }: { children: ReactNode; selected?: boolean }) {
  return (
    <PuRadioChoice
      name="review-choice"
      value={typeof children === "string" ? children : "review-choice"}
      label={children}
      checked={selected}
      onChange={() => undefined}
    />
  );
}

function AssessmentChoice({
  children,
  selected = false,
  multiple = false,
}: {
  children: ReactNode;
  selected?: boolean;
  multiple?: boolean;
}) {
  const value = typeof children === "string" ? children : "review-assessment-choice";
  return multiple ? (
    <PuCheckboxChoice
      name="review-assessment-choice"
      value={value}
      label={children}
      checked={selected}
      onChange={() => undefined}
    />
  ) : (
    <PuRadioChoice
      name="review-assessment-choice"
      value={value}
      label={children}
      checked={selected}
      onChange={() => undefined}
    />
  );
}

'''
review = review[:start] + new_helpers + review[end:]
review_path.write_text(review)


# Move the review index itself onto governed shell and typography primitives.
hub_path = Path("src/routes/review.tsx")
hub = hub_path.read_text()
hub = required(
    hub,
    'import { reviewGroups, reviewScreens } from "@/lib/app-review";\n',
    '''import { platformShellStyles as shell } from "@/components/platform-shell-styles";
import { PuEyebrow, PuHeading } from "@/design-system/precision/components";
import { reviewGroups, reviewScreens } from "@/lib/app-review";
''',
    "review hub imports",
)
hub = hub.replace(
    '<div className="gxj-platform-shell min-h-screen bg-background text-foreground">',
    '<div className={shell.shell}>',
    1,
)
hub = hub.replace(
    '<header className="border-b border-foreground/15 bg-background/95">',
    '<header className="border-b border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)]">',
    1,
)
hub = hub.replace(
    '<span className="inline-block shrink-0 rounded-[2px] border border-solid border-foreground px-2.5 py-1.5 text-[11px] font-bold uppercase leading-none tracking-[0.16em]">\n            Gen X Jumps\n          </span>',
    '<span className={shell.brand}>Gen X Jumps</span>',
    1,
)
hub = hub.replace(
    'className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/60"',
    'className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]"',
    1,
)
hub = hub.replace(
    '<main className="gxj-app-surface mx-auto w-full max-w-6xl px-5 pb-16 pt-7 sm:px-8 sm:pt-10">',
    '<main className="gxj-app-surface mx-auto w-full max-w-[var(--pu-content-app)] px-5 pb-16 pt-7 sm:px-8 sm:pt-10 lg:px-10">',
    1,
)
hub = hub.replace(
    '<header className="max-w-3xl border-b border-foreground/15 pb-8">',
    '<header className="max-w-3xl border-b border-[var(--pu-border-subtle)] pb-8">',
    1,
)
hub = hub.replace(
    '<p className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]">Review Hub</p>',
    '<PuEyebrow>Review Hub</PuEyebrow>',
    1,
)
old_h1 = '''          <h1 className="gxj-display-title mt-4 text-5xl uppercase leading-[0.95] tracking-wide sm:text-7xl">
            The Whole App, In One Place
          </h1>'''
new_h1 = '''          <PuHeading level={1} hero className="mt-4">
            The Whole App, In One Place
          </PuHeading>'''
hub = required(hub, old_h1, new_h1, "review hub h1")
hub = hub.replace(
    '''            Each link opens an isolated screen with sample data. Nothing here signs in, changes a
            plan, records progress, or touches a real account.''',
    '''            Each link opens an isolated scenario with sample data. Production routes remain the
            visual authority; review shares the production shell and control primitives. Nothing here
            signs in, changes a plan, records progress, or touches a real account.''',
    1,
)
hub = hub.replace(
    'className="border-b border-foreground/15 py-8 last:border-b-0"',
    'className="border-b border-[var(--pu-border-subtle)] py-8 last:border-b-0"',
)
old_h2 = '<h2 className="gxj-display-title text-3xl uppercase tracking-wide">{group}</h2>'
new_h2 = '<PuHeading level={2}>{group}</PuHeading>'
hub = hub.replace(old_h2, new_h2)
hub = hub.replace(
    'className="divide-y divide-foreground/15 border-t border-foreground/15"',
    'className="divide-y divide-[var(--pu-border-subtle)] border-t border-[var(--pu-border-subtle)]"',
)
hub = hub.replace(
    'focus-visible:ring-2 focus-visible:ring-gxj-orange focus-visible:ring-offset-2',
    'focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px]',
)
hub_path.write_text(hub)


# Update the existing platform shell contract to follow the shared style source.
contract_path = Path("src/lib/accelerator/__tests__/platform-shell-contract.test.ts")
contract = contract_path.read_text()
contract = contract.replace(
    '    const actions = readSource("../../../components/platform-header-actions.tsx");\n',
    '    const actions = readSource("../../../components/platform-header-actions.tsx");\n    const shellStyles = readSource("../../../components/platform-shell-styles.ts");\n',
    1,
)
contract = contract.replace(
    '    expect(shell).toContain("grid-cols-4");',
    '    expect(shell).toContain("platformShellStyles as shell");\n    expect(shellStyles).toContain("grid-cols-4");',
    1,
)
contract = contract.replace(
    '    expect(shell).toContain("safe-area-inset-bottom");',
    '    const shellStyles = readSource("../../../components/platform-shell-styles.ts");\n    expect(shell).toContain("platformShellStyles as shell");\n    expect(shellStyles).toContain("safe-area-inset-bottom");',
    1,
)
contract_path.write_text(contract)


# Add a review-specific guardrail that prevents the internal catalog from recreating its own
# shell/button/choice visual system.
review_contract = Path("src/lib/__tests__/review-system-contract.test.ts")
review_contract.write_text('''import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const reviewScreen = source("../../components/app-review-screen.tsx");
const reviewShell = source("../../components/review-shell.tsx");
const platformShell = source("../../components/platform-shell.tsx");
const reviewHub = source("../../routes/review.tsx");

describe("review catalog production-system guardrail", () => {
  it("uses the same governed shell style source as the participant app", () => {
    expect(platformShell).toContain('platformShellStyles as shell');
    expect(reviewShell).toContain('platformShellStyles as shell');
    expect(reviewShell).not.toContain("after:bg-gxj-orange");
    expect(reviewShell).not.toContain("after:bg-gxj-aqua");
  });

  it("delegates review helper controls to production Precision Utility primitives", () => {
    const start = reviewScreen.indexOf("function Section(");
    const end = reviewScreen.indexOf("function Page(", start);
    const helpers = reviewScreen.slice(start, end);

    expect(helpers).toContain("<PuSection");
    expect(helpers).toContain("<PuHeading");
    expect(helpers).toContain("<PuEyebrow");
    expect(helpers).toContain("<PuRadioChoice");
    expect(helpers).toContain("<PuCheckboxChoice");
    expect(helpers).toContain('<Button type="button"');
    expect(helpers).not.toContain("gxj-display-title");
    expect(helpers).not.toContain("border-gxj-orange bg-gxj-mint");
  });

  it("states that live production routes remain the visual authority", () => {
    expect(reviewHub).toContain("Production routes remain the");
    expect(reviewHub).toContain("visual authority; review shares the production shell and control primitives");
  });
});
''')


# Record the bounded internal-tool checkpoint without claiming synthetic route compositions are exact.
state_path = Path("CURRENT_STATE.md")
state = state_path.read_text()
old = '''- Reconcile the review catalog with the real Precision Utility production components so review
  scenarios cannot silently drift from participant-facing routes.'''
new = '''- Continue reducing review-catalog drift in route-specific synthetic scenario compositions. Review
  shell, navigation, buttons, sections, choices, and typography now inherit governed production
  styles/primitives instead of maintaining parallel lookalikes.'''
state = required(state, old, new, "review catalog open work")
old_checkpoint = '''The Precision Utility participant-facing production-route migration is complete at this checkpoint.
Welcome and assessment completion now use shared loading/state treatment, compact setup progress,
restrained Barlow hierarchy, direct page structure, and bounded notices instead of the superseded
display-title, large progress-tile, and card-by-default presentation. Signup handoff, assessment,
plan generation, save, replacement, recovery, and token behavior remain unchanged. Internal
review/preview/admin surfaces and the public sales page are separate follow-up surfaces rather than
participant design authority.'''
new_checkpoint = '''The Precision Utility participant-facing production-route migration is complete. The active internal
checkpoint is review-catalog reconciliation: production PlatformShell and ReviewShell now share one
visual style source, and review-only section/action/choice/status helpers delegate to governed
Precision Utility or shared production primitives. Review scenarios keep fake data for state review,
but production routes remain visual authority. Route-specific synthetic compositions, preview/admin
surfaces, and the public sales page remain separate follow-up work.'''
state = required(state, old_checkpoint, new_checkpoint, "review catalog active checkpoint")
state_path.write_text(state)
