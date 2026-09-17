from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing required fragment: {label}")
    return text.replace(old, new, 1)


# Welcome
welcome_path = Path("src/routes/welcome.tsx")
welcome = welcome_path.read_text()
welcome = replace_required(
    welcome,
    'import { Button } from "@/components/ui/button";\n',
    'import { AppLoadingState, AppStatePanel } from "@/components/precision-surfaces";\nimport { SetupProgress } from "@/components/setup-progress";\nimport { Button } from "@/components/ui/button";\n',
    "welcome shared imports",
)
steps = '''const steps = [
  { number: 1, label: "Access saved", state: "complete" },
  { number: 2, label: "Quick setup", state: "current" },
  { number: 3, label: "Plan ready", state: "upcoming" },
] as const;

'''
welcome = replace_required(welcome, steps, "", "welcome old step data")
old_loading = '''  if (!result) {
    return (
      <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-2xl place-items-center px-5 py-8">
        <p className="text-sm text-muted-foreground" role="status">
          Opening your setup...
        </p>
      </div>
    );
  }'''
new_loading = '''  if (!result) {
    return (
      <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-2xl place-items-center px-5 py-8">
        <AppLoadingState label="Opening your setup" className="w-full max-w-md" />
      </div>
    );
  }'''
welcome = replace_required(welcome, old_loading, new_loading, "welcome loading")
old_error = '''  if (!result.ok) {
    return (
      <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-xl place-items-center px-5 py-8">
        <section className="w-full rounded-lg border border-border bg-card p-5 sm:p-7">
          <p className="gxj-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
            Let&rsquo;s Try That Again
          </p>
          <h1 className="gxj-display-title mt-3 text-3xl leading-tight tracking-tight">
            We Couldn&rsquo;t Find Your Signup
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your secure setup may have expired or this browser may have blocked it. Return to the
            website and submit the short form again.
          </p>
          <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
            <a href="https://genxjumps.com/start-here/">Return to My Signup</a>
          </Button>
        </section>
      </div>
    );
  }'''
new_error = '''  if (!result.ok) {
    return (
      <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-xl place-items-center px-5 py-8">
        <AppStatePanel
          state="error"
          title="We Couldn't Find Your Signup"
          description="Your secure setup may have expired or this browser may have blocked it. Return to the website and submit the short form again."
          action={
            <Button asChild>
              <a href="https://genxjumps.com/start-here/">Return to My Signup</a>
            </Button>
          }
          className="w-full"
        />
      </div>
    );
  }'''
welcome = replace_required(welcome, old_error, new_error, "welcome error")
welcome = welcome.replace(
    '''            <div className="relative mx-auto mb-7 h-16 w-20" aria-hidden="true">
              <Mail
                className="absolute inset-0 size-16 translate-x-2 translate-y-2 text-gxj-orange"
                strokeWidth={2.2}
              />
              <Mail className="absolute inset-0 size-16 text-foreground" strokeWidth={2.2} />
            </div>''',
    '''            <div
              className="mx-auto mb-6 grid size-12 place-items-center rounded-[var(--pu-radius-contained)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)]"
              aria-hidden="true"
            >
              <Mail className="size-6 text-[var(--pu-action-primary)]" strokeWidth={2} />
            </div>''',
)
welcome = welcome.replace(
    'className="gxj-display-title text-3xl uppercase leading-none tracking-wide sm:text-4xl"',
    'className="text-3xl font-extrabold leading-tight sm:text-4xl"',
)
welcome = welcome.replace(
    'className="mx-auto mt-3 max-w-xl text-base font-medium leading-relaxed text-foreground/75"',
    'className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-[var(--pu-text-secondary)]"',
)
welcome = welcome.replace(
    'className="mt-3 text-sm font-medium text-muted-foreground"',
    'className="mt-3 text-sm text-[var(--pu-text-secondary)]"',
)
welcome = welcome.replace(
    'className="mx-auto max-w-3xl border-t border-foreground/20 pt-5 text-center"',
    'className="mx-auto max-w-3xl border-t border-[var(--pu-border-subtle)] pt-5 text-center"',
)
welcome = welcome.replace(
    'className="gxj-display-title min-h-14 w-full px-6 text-xl uppercase leading-none tracking-wide sm:w-auto"',
    'className="w-full sm:w-auto"',
)
welcome = welcome.replace(
    'className="gxj-kicker text-xs font-bold uppercase tracking-[0.16em]"',
    'className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-action-primary)]"',
)
welcome = welcome.replace(
    'className="gxj-display-title mt-4 text-3xl uppercase leading-none tracking-wide sm:text-4xl"',
    'className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl"',
)
welcome = welcome.replace(
    'className="mt-3 max-w-xl text-base font-medium leading-relaxed text-foreground/75"',
    'className="mt-3 max-w-xl text-base leading-relaxed text-[var(--pu-text-secondary)]"',
)
start = welcome.find('      <ol className="grid max-w-3xl grid-cols-3 gap-2" aria-label="Plan setup progress">')
if start < 0:
    raise SystemExit("Missing Welcome old progress list")
end = welcome.find("      </ol>", start)
if end < 0:
    raise SystemExit("Could not bound Welcome old progress list")
end += len("      </ol>")
new_progress = '''      <div className="max-w-3xl">
        <SetupProgress currentStep={2} label="Plan setup progress" />
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pu-text-secondary)]">
          <span>Access saved</span>
          <span className="text-[var(--pu-action-primary)]">Quick setup</span>
          <span>Plan ready</span>
        </div>
      </div>'''
welcome = welcome[:start] + new_progress + welcome[end:]
welcome = welcome.replace(
    'className="mt-7 max-w-3xl border-t border-foreground/20 pt-5"',
    'className="mt-7 max-w-3xl border-t border-[var(--pu-border-subtle)] pt-5"',
)
welcome = welcome.replace(
    'className="mt-3 text-sm font-medium text-muted-foreground"',
    'className="mt-3 text-sm text-[var(--pu-text-secondary)]"',
)
welcome_path.write_text(welcome)


# Assessment completion
assessment_path = Path("src/routes/assessment.complete.tsx")
assessment = assessment_path.read_text()
assessment = replace_required(
    assessment,
    'import { Button } from "@/components/ui/button";\n',
    'import { AppLoadingState, AppNotice, AppStatePanel } from "@/components/precision-surfaces";\nimport { Button } from "@/components/ui/button";\n',
    "assessment shared imports",
)
assessment = assessment.replace(
    'className="gxj-display-title text-2xl leading-tight tracking-tight sm:text-3xl"',
    'className="text-3xl font-extrabold leading-tight sm:text-4xl"',
    1,
)
old_recognized = '''      {recognized ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Your saved plan is still intact. Confirm below if you want to replace it with these
          answers.
        </p>
      ) : null}'''
new_recognized = '''      {recognized ? (
        <AppNotice tone="warning" className="mt-4">
          Your saved plan is still intact. Confirm below if you want to replace it with these
          answers.
        </AppNotice>
      ) : null}'''
assessment = replace_required(assessment, old_recognized, new_recognized, "assessment recognized notice")
assessment = assessment.replace(
    'className="mt-6 rounded-lg border border-border bg-card p-4"',
    'className="mt-6 border-y border-[var(--pu-border-strong)] py-5"',
    1,
)
assessment = assessment.replace(
    'className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"',
    'className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]"',
    1,
)
assessment = assessment.replace(
    'className="mt-4 rounded-lg border border-border bg-card p-4"',
    'className="mt-5 border-b border-[var(--pu-border-subtle)] pb-5"',
    1,
)
assessment = assessment.replace(
    'className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"',
    'className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]"',
    1,
)
assessment = assessment.replace(
    'className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border"',
    'className="mt-3 divide-y divide-[var(--pu-border-subtle)] border-y border-[var(--pu-border-strong)]"',
    1,
)
assessment = assessment.replace('className="bg-card px-4 py-2.5"', 'className="py-3"', 1)
assessment = assessment.replace(
    'className={unlocked ? "bg-card px-4 py-2" : "bg-muted/30 px-4 py-2"}',
    'className={unlocked ? "py-3" : "bg-[var(--pu-surface-subtle)] py-3"}',
    1,
)
assessment = assessment.replace(
    '? "text-sm font-medium"\n                      : "text-sm font-medium text-muted-foreground/80"',
    '? "text-sm font-medium"\n                      : "text-sm font-medium text-[var(--pu-text-secondary)]"',
    1,
)
# Recognized replacement confirmation is a bounded consequential state, not ordinary content.
assessment = assessment.replace(
    'className="rounded-lg border border-border bg-card p-4"',
    'className="border-y border-[var(--pu-border-strong)] py-5"',
    1,
)
old_error = '''          {error ? (
            <p role="alert" className="mt-3">
              {error}
            </p>
          ) : null}'''
new_error = '''          {error ? (
            <AppNotice tone="danger" className="mt-4" role="alert">
              {error}
            </AppNotice>
          ) : null}'''
assessment = replace_required(assessment, old_error, new_error, "assessment replacement error")
old_unlocked = '''      ) : unlocked ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Your Full 7-Day Workout Plan Is Unlocked
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your complete workout and recovery schedule is now available. Start with Day 1 and
            follow the plan in order.
          </p>
        </section>'''
new_unlocked = '''      ) : unlocked ? (
        <AppNotice tone="success">
          <strong className="block text-[var(--pu-text-primary)]">
            Your Full 7-Day Workout Plan Is Unlocked
          </strong>
          <span className="mt-1 block">
            Your complete workout and recovery schedule is now available. Start with Day 1 and
            follow the plan in order.
          </span>
        </AppNotice>'''
assessment = replace_required(assessment, old_unlocked, new_unlocked, "assessment unlocked success")
old_opening = '''      ) : checkingAccess ||
        handoffStatus === "checking" ||
        handoffStatus === "available" ||
        intakeDraft ? (
        <section className="rounded-lg border border-border bg-card p-4" aria-live="polite">
          <h2 className="text-lg font-semibold tracking-tight">Opening Your 7-Day Plan</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {error
              ? "Your answers are still here. Try saving your plan again."
              : "Your answers are complete. We’re saving your plan now."}
          </p>
          {error ? (
            <Button
              type="button"
              className="mt-4 w-full sm:w-auto"
              onClick={() => window.location.reload()}
            >
              Try Saving My Plan Again
            </Button>
          ) : null}
        </section>'''
new_opening = '''      ) : checkingAccess ||
        handoffStatus === "checking" ||
        handoffStatus === "available" ||
        intakeDraft ? (
        <div aria-live="polite">
          {error ? (
            <>
              <AppNotice tone="danger">Your answers are still here. Try saving your plan again.</AppNotice>
              <Button
                type="button"
                className="mt-4 w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                Try Saving My Plan Again
              </Button>
            </>
          ) : (
            <div>
              <p className="mb-3 text-sm font-semibold">Opening Your 7-Day Plan</p>
              <AppLoadingState label="Saving your 7-Day plan" lines={2} />
            </div>
          )}
        </div>'''
assessment = replace_required(assessment, old_opening, new_opening, "assessment opening state")
old_missing = '''      ) : (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold tracking-tight">Your Answers Are Still Saved</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We couldn&rsquo;t find the secure signup that brought you here. Return to the short
            website form and submit it again. You won&rsquo;t need to repeat these assessment
            answers.
          </p>
          <Button asChild className="mt-4 w-full sm:w-auto">
            <a href="https://genxjumps.com/start-here/#seven-day-optin">Return to My Signup</a>
          </Button>
        </section>
      )}'''
new_missing = '''      ) : (
        <AppStatePanel
          state="error"
          title="Your Answers Are Still Saved"
          description="We couldn't find the secure signup that brought you here. Return to the short website form and submit it again. You won't need to repeat these assessment answers."
          action={
            <Button asChild>
              <a href="https://genxjumps.com/start-here/#seven-day-optin">Return to My Signup</a>
            </Button>
          }
        />
      )}'''
assessment = replace_required(assessment, old_missing, new_missing, "assessment missing signup state")
assessment_path.write_text(assessment)


# Current state
state_path = Path("CURRENT_STATE.md")
state = state_path.read_text()
old_open = '''- Complete the remaining Precision Utility route-specific residue after the shared primitives are in
  place. Welcome and assessment-completion onboarding surfaces remain after the member-platform cleanup.'''
new_open = '''- Reconcile the review catalog with the real Precision Utility production components so review
  scenarios cannot silently drift from participant-facing routes.'''
state = replace_required(state, old_open, new_open, "current state open work")
old_checkpoint = '''Precision Utility route-specific residue cleanup is the active design checkpoint. The current
bounded checkpoint removes the remaining member-platform residue from 7-Day completion/repeat and
install surfaces, Accelerator history/completion/paused states, and checkout success while preserving
all progression, purchase, measurement, install, and restart behavior. Welcome and assessment
completion remain as the next onboarding-specific cleanup.'''
new_checkpoint = '''Precision Utility route-specific residue cleanup is at its final production-route checkpoint. Welcome
and assessment completion now use shared loading/state treatment, compact setup progress, restrained
Barlow hierarchy, direct page structure, and bounded notices instead of the superseded display-title,
large progress-tile, and card-by-default presentation. Signup handoff, assessment, plan generation,
save, replacement, recovery, and token behavior remain unchanged. Internal review/preview/admin
surfaces and the public sales page are separate follow-up surfaces rather than participant design
authority.'''
state = replace_required(state, old_checkpoint, new_checkpoint, "current state checkpoint")
state_path.write_text(state)
