from pathlib import Path


def update(path: str, replacements: list[tuple[str, str]], optional: list[tuple[str, str]] = []):
    p = Path(path)
    text = p.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f"Missing required fragment in {path}: {old[:180]}")
        text = text.replace(old, new)
    for old, new in optional:
        text = text.replace(old, new)
    p.write_text(text)


update(
    "src/components/pwa-install.tsx",
    [
        (
            'className="mt-6 rounded-lg border border-border bg-card p-4"',
            'className="mt-6 border-y border-[var(--pu-border-subtle)] py-5"',
        ),
        (
            'className="rounded-lg border border-gxj-teal bg-gxj-mint p-4"',
            'className="rounded-[var(--pu-radius-control)] border border-[var(--pu-status-success)] bg-[var(--pu-surface-contained)] p-4"',
        ),
        (
            'className="size-5 text-gxj-teal"',
            'className="size-5 text-[var(--pu-status-success)]"',
        ),
        (
            'className="text-xs font-semibold uppercase tracking-[0.15em] text-gxj-teal"',
            'className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-action-primary)]"',
        ),
        (
            ': "gxj-display-title mt-7 min-h-20 w-full justify-between gap-5 bg-foreground px-5 text-left text-2xl uppercase leading-none tracking-wide text-background shadow-[3px_3px_0_color-mix(in_oklch,var(--color-foreground)_14%,transparent)] hover:bg-foreground/90 sm:px-7 sm:text-3xl"',
            ': "mt-7 w-full sm:w-auto"',
        ),
        (
            '''        {compact ? <Download aria-hidden="true" className="size-4" /> : null}\n        <span>{working ? "Opening..." : "Add to My Home Screen"}</span>\n        {!compact ? (\n          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-background text-gxj-orange sm:size-12">\n            <Download aria-hidden="true" className="size-5" strokeWidth={2.5} />\n          </span>\n        ) : null}''',
            '''        <Download aria-hidden="true" className="size-4" />\n        <span>{working ? "Opening..." : "Add to My Home Screen"}</span>''',
        ),
    ],
    optional=[
        (
            'rounded-md border border-border bg-background p-3',
            'rounded-[var(--pu-radius-control)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] p-3',
        ),
        (
            'rounded-md border border-border bg-background p-4',
            'rounded-[var(--pu-radius-control)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] p-4',
        ),
        ('text-gxj-teal', 'text-[var(--pu-action-primary)]'),
    ],
)

update(
    "src/components/seven-day-next-step.tsx",
    [
        (
            'className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-7"',
            'className="mt-6 border-y border-[var(--pu-border-strong)] py-6"',
        ),
        (
            'className="text-xs font-semibold uppercase tracking-widest text-gxj-teal"',
            'className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-action-primary)]"',
        ),
        (
            'className="mt-3 text-2xl font-semibold"',
            'className="mt-3 text-2xl font-extrabold leading-tight"',
        ),
    ],
)

plan = Path("src/routes/your-plan.index.tsx")
text = plan.read_text()
anchor = 'import { SevenDayNextStep } from "@/components/seven-day-next-step";\n'
if anchor not in text:
    raise SystemExit("Missing plan import anchor")
text = text.replace(
    anchor,
    anchor + 'import { AppLinearProgress, AppLoadingState } from "@/components/precision-surfaces";\n',
    1,
)
old_loading = '''  if (status === "checking") {\n    return (\n      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">\n        <p className="text-sm text-muted-foreground">Loading your plan...</p>\n      </div>\n    );\n  }'''
new_loading = '''  if (status === "checking") {\n    return (\n      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">\n        <AppLoadingState label="Loading your plan" />\n      </div>\n    );\n  }'''
if old_loading not in text:
    raise SystemExit("Missing plan loading state")
text = text.replace(old_loading, new_loading, 1)
text = text.replace(
    'className="gxj-display-title mt-2 text-2xl leading-tight tracking-tight sm:text-3xl"',
    'className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl"',
    1,
)
old_progress = '''      <div\n        className="mt-2 h-2 w-full overflow-hidden rounded-[2px] bg-muted"\n        role="progressbar"\n        aria-valuemin={0}\n        aria-valuemax={TOTAL_ASSIGNMENTS}\n        aria-valuenow={completedCount}\n        aria-label="Plan progress"\n      >\n        <div className="h-full bg-gxj-teal" style={{ width: `${pct}%` }} />\n      </div>'''
new_progress = '''      <AppLinearProgress value={pct} label="Plan progress" className="mt-3" />'''
if old_progress not in text:
    raise SystemExit("Missing plan progress block")
text = text.replace(old_progress, new_progress, 1)
text = text.replace(
    'className="mt-6 rounded-lg border border-border bg-card p-4"',
    'className="mt-6 border-y border-[var(--pu-border-strong)] py-5"',
    1,
)
text = text.replace(
    'className="mt-3 rounded-lg border border-border bg-card p-4"',
    'className="mt-3 rounded-[var(--pu-radius-contained)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] p-4"',
    1,
)
text = text.replace(
    'className={`mt-8 scroll-mt-6 rounded-lg border border-border p-4 ${\n          currentEntry ? "bg-card" : "bg-gxj-mint"\n        }`}',
    'className={`mt-8 scroll-mt-6 rounded-[var(--pu-radius-contained)] border border-[var(--pu-border-subtle)] p-4 ${\n          currentEntry ? "bg-[var(--pu-surface-contained)]" : "bg-[var(--pu-action-tint)]"\n        }`}',
    1,
)
text = text.replace(
    'className="mt-3 rounded-md border border-dashed border-border p-3"',
    'className="mt-3 rounded-[var(--pu-radius-control)] border border-dashed border-[var(--pu-border-subtle)] p-3"',
)
plan.write_text(text)

update(
    "src/routes/my-programs_.accelerator.runs.tsx",
    [
        (
            'import { PlatformPage } from "@/components/platform-page";\n',
            'import { PlatformPage } from "@/components/platform-page";\nimport { AppLoadingState, AppStatePanel } from "@/components/precision-surfaces";\n',
        ),
        (
            '  if (!result)\n    return <p className="text-sm text-muted-foreground">Loading Accelerator history...</p>;',
            '''  if (!result)\n    return (\n      <PlatformPage kicker="Programs" title="Accelerator History">\n        <AppLoadingState label="Loading Accelerator history" />\n      </PlatformPage>\n    );''',
        ),
        ('<div className="space-y-3">', '<div className="divide-y divide-[var(--pu-border-subtle)] border-y border-[var(--pu-border-strong)]">'),
        (
            'className="rounded-lg border border-border bg-card p-5"',
            'className="py-5"',
        ),
        (
            'className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"',
            'className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--pu-border-subtle)] pt-4 sm:grid-cols-2 lg:grid-cols-4"',
        ),
    ],
    optional=[
        ('className="rounded-md bg-muted/60 p-3"', 'className="py-1"'),
    ],
)
runs = Path("src/routes/my-programs_.accelerator.runs.tsx")
rtext = runs.read_text()
old_empty = '''        {!runs.length ? (\n          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">\n            No Accelerator history yet.\n          </p>\n        ) : null}'''
new_empty = '''        {!runs.length ? (\n          <AppStatePanel\n            state="empty"\n            title="No Accelerator history yet"\n            description="Completed or replaced runs will stay here."\n          />\n        ) : null}'''
if old_empty not in rtext:
    raise SystemExit("Missing Accelerator history empty state")
runs.write_text(rtext.replace(old_empty, new_empty, 1))

update(
    "src/routes/checkout.accelerator.success.tsx",
    [
        (
            'className="rounded-lg border border-border bg-card p-6"',
            'className="border-y border-[var(--pu-border-strong)] py-6"',
        ),
        (
            'className="grid size-11 place-items-center rounded-full bg-muted"',
            'className="grid size-11 place-items-center rounded-full bg-[var(--pu-status-success)] text-white"',
        ),
    ],
)

program = Path("src/components/accelerator-program.tsx")
ptext = program.read_text()
anchor = 'import { AcceleratorCompletion } from "@/components/accelerator-completion";\n'
if anchor not in ptext:
    raise SystemExit("Missing accelerator program import anchor")
ptext = ptext.replace(
    anchor,
    anchor + 'import { AppLinearProgress, AppNotice } from "@/components/precision-surfaces";\n',
    1,
)
ptext = ptext.replace(
    'className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight sm:text-4xl"',
    'className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl"',
    1,
)
old_program_progress = '''        <div\n          className="mt-4 h-2.5 overflow-hidden rounded-[2px] bg-muted"\n          role="progressbar"\n          aria-valuemin={0}\n          aria-valuemax={28}\n          aria-valuenow={completedCount}\n          aria-label="Accelerator progress"\n        >\n          <div className="h-full bg-gxj-teal" style={{ width: `${progressPercent}%` }} />\n        </div>'''
new_program_progress = '''        <AppLinearProgress\n          value={progressPercent}\n          label="Accelerator progress"\n          accent="aqua"\n          className="mt-4"\n        />'''
if old_program_progress not in ptext:
    raise SystemExit("Missing accelerator progress block")
ptext = ptext.replace(old_program_progress, new_program_progress, 1)
old_return = '''      {returnMessage && actionableDay ? (\n        <p className="mt-5 rounded-lg border border-border bg-gxj-mint p-4 text-sm leading-relaxed">\n          {returnMessage}\n        </p>\n      ) : null}'''
new_return = '''      {returnMessage && actionableDay ? (\n        <AppNotice tone="info" className="mt-5">\n          {returnMessage}\n        </AppNotice>\n      ) : null}'''
if old_return not in ptext:
    raise SystemExit("Missing accelerator return message")
ptext = ptext.replace(old_return, new_return, 1)
ptext = ptext.replace(
    'className="rounded-lg border border-border bg-gxj-mint p-6"',
    'className="border-y border-[var(--pu-border-strong)] py-6"',
    1,
)
ptext = ptext.replace(
    'className="rounded-lg border border-border bg-card p-6"',
    'className="border-y border-[var(--pu-border-strong)] py-6"',
    1,
)
ptext = ptext.replace(
    'className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal"',
    'className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-accent-program)]"',
    1,
)
program.write_text(ptext)

update(
    "src/components/accelerator-completion.tsx",
    [
        (
            'className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"',
            'className="min-h-12 rounded-[var(--pu-radius-control)] border border-[var(--pu-border-strong)] bg-[var(--pu-surface-contained)] px-3 text-base"',
        ),
        (
            'className="rounded-lg border border-border bg-gxj-mint p-6"',
            'className="border-y border-[var(--pu-border-strong)] py-6"',
        ),
        (
            'className="flex size-10 items-center justify-center rounded-full bg-gxj-teal text-white"',
            'className="flex size-10 items-center justify-center rounded-full bg-[var(--pu-status-success)] text-white"',
        ),
        (
            'className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal"',
            'className="mt-5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-status-success)]"',
        ),
        (
            'className="mt-6 grid gap-3 sm:grid-cols-3"',
            'className="mt-6 grid gap-x-6 gap-y-4 border-y border-[var(--pu-border-subtle)] py-4 sm:grid-cols-3 sm:divide-x sm:divide-[var(--pu-border-subtle)]"',
        ),
        (
            'className="mt-6 rounded-lg border border-border bg-background/80 p-4"',
            'className="mt-6 rounded-[var(--pu-radius-contained)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] p-4"',
        ),
    ],
    optional=[
        ('className="rounded-md bg-background/80 p-4"', 'className="py-2 sm:px-4 first:sm:pl-0"'),
    ],
)

# Update the stale focused-install visual contract while preserving copy/behavior assertions.
pwa_test = Path("src/lib/__tests__/pwa-install-contract.test.ts")
t = pwa_test.read_text()
old = '''    expect(component).toContain("min-h-20 w-full justify-between");\n    expect(component).toContain("bg-foreground");\n    expect(component).toContain("rounded-full bg-background text-gxj-orange");\n    expect(component).not.toContain("rounded-lg border border-border bg-card p-5 sm:p-6");\n    expect(component).toContain('compact\\n            ? "mt-5 w-full sm:w-auto"');'''
new = '''    expect(component).not.toContain("min-h-20 w-full justify-between");\n    expect(component).not.toContain("rounded-full bg-background text-gxj-orange");\n    expect(component).toContain(': "mt-7 w-full sm:w-auto"');\n    expect(component).toContain("border-y border-[var(--pu-border-subtle)] py-5");\n    expect(component).toContain('compact\\n            ? "mt-5 w-full sm:w-auto"');'''
if old not in t:
    raise SystemExit("Missing old PWA visual contract")
pwa_test.write_text(t.replace(old, new, 1))

state = Path("CURRENT_STATE.md")
s = state.read_text()
old = '''- Complete the remaining Precision Utility route-specific residue after the shared primitives are in\n  place. Smaller participant history, completion, and install surfaces remain after Nutrition.'''
new = '''- Complete the remaining Precision Utility route-specific residue after the shared primitives are in\n  place. Welcome and assessment-completion onboarding surfaces remain after the member-platform cleanup.'''
if old not in s:
    raise SystemExit("Missing current-state open residue line")
s = s.replace(old, new, 1)
old2 = '''Precision Utility route-specific residue cleanup is the active design checkpoint. The current\nbounded checkpoint migrates Nutrition setup and results presentation onto the approved system while\npreserving calculator logic, saved drafts, target math, access gating, sliders, and server behavior.\nNutrition now uses shared states/notices/choices, restrained heading hierarchy, thin structural rules,\nand direct target stats. Smaller participant history, completion, and install surfaces remain next.'''
new2 = '''Precision Utility route-specific residue cleanup is the active design checkpoint. The current\nbounded checkpoint removes the remaining member-platform residue from 7-Day completion/repeat and\ninstall surfaces, Accelerator history/completion/paused states, and checkout success while preserving\nall progression, purchase, measurement, install, and restart behavior. Welcome and assessment\ncompletion remain as the next onboarding-specific cleanup.'''
if old2 not in s:
    raise SystemExit("Missing current-state active checkpoint block")
state.write_text(s.replace(old2, new2, 1))
