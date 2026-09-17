from pathlib import Path

path = Path("src/components/app-review-screen.tsx")
text = path.read_text()


def replace_block(source: str, start: str, end: str, replacement: str) -> str:
    a = source.find(start)
    if a < 0:
        raise SystemExit(f"Missing start marker: {start}")
    b = source.find(end, a)
    if b < 0:
        raise SystemExit(f"Missing end marker: {end}")
    return source[:a] + replacement.rstrip() + "\n\n" + source[b:]


old_import = 'import { PlatformPage } from "@/components/platform-page";\n'
new_import = '''import { PlatformPage } from "@/components/platform-page";
import {
  AppLinearProgress,
  AppList,
  AppListRow,
  AppLoadingState,
  AppNotice,
  AppStatePanel,
} from "@/components/precision-surfaces";
'''
if old_import not in text:
    raise SystemExit("Missing PlatformPage import")
text = text.replace(old_import, new_import, 1)

home = r'''function HomeReview({ variant }: { variant: string }) {
  const summary =
    variant === "empty"
      ? ["1 program", "No measurements yet", "Set up your daily targets"]
      : ["2 programs", "Weight: 175 lb", "2,100 calories per day"];
  const rows = [
    { title: "Programs", line: summary[0], icon: Dumbbell },
    { title: "Progress", line: summary[1], icon: ChartNoAxesColumnIncreasing },
    { title: "Nutrition", line: summary[2], icon: Apple },
  ];

  if (variant === "loading") {
    return (
      <Page title="Home" description="We’re getting your plan ready." titleSize="compact">
        <AppLoadingState label="Loading Home" />
      </Page>
    );
  }

  if (variant === "error") {
    return (
      <Page title="Home" description="Your saved work hasn’t changed." titleSize="compact">
        <AppStatePanel
          state="error"
          title="Your Programs Couldn't Be Loaded"
          description="Open My Programs to try again."
          action={<Action>Open My Programs</Action>}
        />
      </Page>
    );
  }

  const sevenDay = variant === "seven-day";
  const accelerator = variant === "accelerator";
  const empty = variant === "empty";
  const kicker = sevenDay ? "Day 3 of 7" : accelerator ? "Day 9 of 28" : "Your Next Step";
  const title = sevenDay
    ? WORKOUTS.W03.title
    : accelerator
      ? "Upper Body B"
      : "Choose What Comes Next";
  const description = sevenDay
    ? "Your next workout is ready."
    : accelerator
      ? "Your strength workout is ready."
      : "Your programs and progress are saved here.";
  const action = accelerator ? "Open Today's Workout" : empty ? "Open My Programs" : null;

  return (
    <Page
      kicker={kicker}
      title={title}
      description={description}
      titleSize="compact"
      contentGap="tight"
    >
      {sevenDay ? (
        <WorkoutLaunchPanel
          day={3}
          title={WORKOUTS.W03.title}
          actionLabel="Open Today’s Workout"
          href="/review/workout-day-3-ready"
        />
      ) : action ? (
        <div>
          <Action>
            {action}
            <ArrowRight className="size-4" />
          </Action>
        </div>
      ) : null}

      <section className="mt-8 border-t border-[var(--pu-border-strong)] pt-6" aria-labelledby="fitness-hub">
        <h2 id="fitness-hub" className="text-2xl font-extrabold leading-tight sm:text-3xl">
          Your Gen X Jumps Fitness Hub
        </h2>
        <AppList className="mt-4">
          {rows.map(({ title: rowTitle, line, icon: Icon }) => (
            <AppListRow
              key={rowTitle}
              title={
                <span className="flex items-center gap-3">
                  <Icon className="size-5" aria-hidden="true" />
                  {rowTitle}
                </span>
              }
              detail={line}
              end={<ArrowRight className="size-5" aria-hidden="true" />}
            />
          ))}
        </AppList>
      </section>
    </Page>
  );
}'''
text = replace_block(text, "function HomeReview", "const LANDING_BEFORE_PHOTO", home)

# Keep the review assessment questions/content, but remove the retired progress tiles and display hierarchy.
assessment_start = text.find("function AssessmentReview")
assessment_end = text.find("function AssessmentResultReview", assessment_start)
if assessment_start < 0 or assessment_end < 0:
    raise SystemExit("Missing AssessmentReview block")
assessment = text[assessment_start:assessment_end]
old_progress = r'''          <div className="grid max-w-md grid-cols-3 gap-2" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((segment) => {
              const state =
                segment < stepNumber ? "complete" : segment === stepNumber ? "current" : "upcoming";
              return (
                <div
                  key={segment}
                  aria-current={state === "current" ? "step" : undefined}
                  className={`flex min-h-11 items-center px-3 ${
                    state === "complete"
                      ? "bg-foreground text-background"
                      : state === "current"
                        ? "bg-gxj-orange text-white shadow-[2px_2px_0_color-mix(in_oklch,var(--color-foreground)_18%,transparent)]"
                        : "border-2 border-foreground/20 text-foreground/35"
                  }`}
                >
                  <span className="gxj-display-title text-xl leading-none tracking-wide">
                    {String(segment).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>'''
if old_progress not in assessment:
    raise SystemExit("Missing assessment progress tiles")
assessment = assessment.replace(
    old_progress,
    '          <SetupProgress currentStep={stepNumber} label={`Step ${step} of 3`} />',
    1,
)
assessment = assessment.replace(
    'className="gxj-display-title mt-4 text-3xl uppercase leading-none tracking-wide sm:text-4xl"',
    'className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl"',
)
assessment = assessment.replace(
    'border-t-2 border-foreground/20 py-6 sm:py-8',
    'border-t border-[var(--pu-border-subtle)] py-6 sm:py-8',
)
assessment = assessment.replace(
    'border-t border-foreground/20 pt-5',
    'border-t border-[var(--pu-border-subtle)] pt-5',
)
assessment = assessment.replace(
    'border-2 border-foreground/25 bg-background',
    'border border-[var(--pu-border-strong)] bg-[var(--pu-surface-contained)]',
)
assessment = assessment.replace(
    'border-l-2 border-foreground/20 bg-foreground/5',
    'border-l border-[var(--pu-border-subtle)] bg-[var(--pu-surface-subtle)]',
)
assessment = assessment.replace(
    'bg-foreground font-bold text-background',
    'bg-[var(--pu-text-primary)] font-bold text-white',
)
text = text[:assessment_start] + assessment + text[assessment_end:]

assessment_result = r'''function AssessmentResultReview({ replace }: { replace: boolean }) {
  return (
    <Page
      kicker={replace ? "Plan Update" : "Your Plan Is Ready"}
      title={replace ? "Review Your New Starting Point" : "Your Personalized 7-Day Fitness Plan Is Ready"}
      description="Four short jump rope and strength days, two easier movement days, and one full recovery day."
      titleSize="compact"
    >
      <section className="border-y border-[var(--pu-border-strong)] py-5">
        <h2 className="text-2xl font-extrabold leading-tight">Your plan at a glance</h2>
        <div className="mt-5 grid grid-cols-3 gap-4">
          {[
            ["7", "days"],
            ["4", "workouts"],
            ["15", "minutes"],
          ].map(([value, label]) => (
            <div key={label}>
              <strong className="text-3xl font-extrabold leading-none">{value}</strong>
              <p className="mt-1 text-sm text-[var(--pu-text-secondary)]">{label}</p>
            </div>
          ))}
        </div>
      </section>
      {replace ? (
        <AppNotice tone="warning">
          <strong className="text-[var(--pu-text-primary)]">Replacing this plan clears its current progress.</strong>
          <span className="mt-1 block">
            Your paid programs and completed program history stay in your account.
          </span>
        </AppNotice>
      ) : null}
      <Action>{replace ? "Replace My 7-Day Plan" : "Save My Plan"}</Action>
    </Page>
  );
}'''
text = replace_block(text, "function AssessmentResultReview", "function WelcomeReview", assessment_result)

welcome = r'''function WelcomeReview({ variant }: { variant: string }) {
  if (variant === "setup") {
    return (
      <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
        <header className="py-6 sm:py-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-action-primary)]">
              Congratulations
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
              Todd, Let&rsquo;s Build Your Comeback Plan
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--pu-text-secondary)]">
              Answer a few quick questions about your fitness, schedule, equipment, and any
              limitations. Then we&rsquo;ll build your personalized 7-day plan immediately.
            </p>
          </div>
        </header>

        <div className="max-w-3xl">
          <SetupProgress currentStep={2} label="Plan setup progress" />
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pu-text-secondary)]">
            <span>Access saved</span>
            <span className="text-[var(--pu-action-primary)]">Quick setup</span>
            <span>Plan ready</span>
          </div>
        </div>

        <div className="mt-7 max-w-3xl border-t border-[var(--pu-border-subtle)] pt-5">
          <Action>Create My 7-Day Plan</Action>
          <p className="mt-3 text-sm text-[var(--pu-text-secondary)]">
            About 2 minutes. No password required.
          </p>
        </div>
      </div>
    );
  }

  const returning = variant === "returning";
  return (
    <div className="gxj-page mx-auto min-h-full w-full max-w-5xl px-4 pb-10 sm:px-8 sm:pb-14">
      <header className="py-6 sm:py-8">
        <div className="mx-auto max-w-2xl text-center">
          <div
            className="mx-auto mb-6 grid size-12 place-items-center rounded-[var(--pu-radius-contained)] border border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)]"
            aria-hidden="true"
          >
            <Mail className="size-6 text-[var(--pu-action-primary)]" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
            {returning ? "Welcome Back" : "Check Your Email"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-[var(--pu-text-secondary)]">
            {returning
              ? "We found an existing Gen X Jumps account. Use the secure link we sent to get back in."
              : "Your secure access link is on its way. Open it on the device where you want to use your plan."}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl border-t border-[var(--pu-border-subtle)] pt-5 text-center">
        <Action>{returning ? "Send Another Link" : "Open My Email"}</Action>
      </div>
    </div>
  );
}'''
text = replace_block(text, "function WelcomeReview", "function PlanReadyReview", welcome)

plan_ready = r'''function PlanReadyReview() {
  return (
    <Page
      kicker="Your Plan Is Ready"
      title="Todd, Keep Your Comeback One Tap Away"
      description="Add Gen X Jumps to your Home Screen for quick access to your workouts, nutrition targets, and progress."
      titleSize="compact"
    >
      <div className="max-w-lg">
        <Action>
          <Download aria-hidden="true" className="size-4" />
          Add to My Home Screen
        </Action>
        <p className="mt-3 text-sm text-[var(--pu-text-secondary)]">No app store required.</p>
        <button
          type="button"
          className="mt-5 block min-h-11 text-sm font-medium text-[var(--pu-text-secondary)] underline-offset-4 hover:text-[var(--pu-text-primary)] hover:underline"
        >
          Not Now - View My Plan
        </button>
      </div>
    </Page>
  );
}'''
text = replace_block(text, "function PlanReadyReview", "const PLAN_REVIEW_DAYS", plan_ready)

progress = r'''function ProgressReview({ variant }: { variant: string }) {
  if (variant === "error") {
    return (
      <Page title="Your Progress" description="Your saved work hasn't been changed." titleSize="compact">
        <AppStatePanel
          state="error"
          title="Progress Couldn't Be Loaded"
          description="Try again without leaving the app."
          action={<Action>Try Again</Action>}
        />
      </Page>
    );
  }

  const percent = variant === "empty" ? 0 : 32;
  return (
    <Page
      title="Your Progress"
      description={
        variant === "empty"
          ? "Complete your first day or add a measurement to begin."
          : "Program completion and measurements stay together here."
      }
      titleSize="compact"
    >
      <section className="border-y border-[var(--pu-border-strong)] py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-accent-program)]">
              28-Day Fat Loss Accelerator
            </p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
              {variant === "empty" ? "0" : "9"} of 28 Days Complete
            </h2>
          </div>
          <p className="text-sm font-bold text-[var(--pu-text-secondary)]">{percent}%</p>
        </div>
        <AppLinearProgress value={percent} label="Accelerator progress" accent="aqua" className="mt-4" />
      </section>

      {variant !== "empty" ? (
        <section className="border-b border-[var(--pu-border-subtle)] py-6">
          <h2 className="text-2xl font-extrabold leading-tight">Latest Measurements</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-[var(--pu-text-secondary)]">Weight</p>
              <p className="mt-1 text-3xl font-extrabold">175 lb</p>
              <p className="text-sm">Down 4 lb</p>
            </div>
            <div>
              <p className="text-sm text-[var(--pu-text-secondary)]">Waist</p>
              <p className="mt-1 text-3xl font-extrabold">34 in</p>
              <p className="text-sm">Down 1 in</p>
            </div>
          </div>
        </section>
      ) : (
        <div className="pt-5">
          <Action>Add Starting Measurements</Action>
        </div>
      )}

      {variant === "history" ? (
        <section className="border-b border-[var(--pu-border-subtle)] py-6">
          <h2 className="text-2xl font-extrabold leading-tight">Completed Programs</h2>
          <p className="mt-4 font-bold">28-Day Accelerator</p>
          <p className="text-sm text-[var(--pu-text-secondary)]">Completed August 28, 2026</p>
        </section>
      ) : null}
    </Page>
  );
}'''
text = replace_block(text, "function ProgressReview", "function NutritionSetupSection", progress)

# Bring the review-only Nutrition setup section onto the same thin-rule structure as production.
text = text.replace(
    'function NutritionSetupSection({\n',
    'function NutritionSetupSection({\n',
    1,
)
text = text.replace(
    '<section className="border-t-2 border-foreground/20 py-6 sm:py-8">\n      <h2 className="text-xl font-bold leading-snug sm:text-2xl">{title}</h2>',
    '<section className="border-t border-[var(--pu-border-subtle)] py-6 sm:py-8">\n      <h2 className="text-xl font-bold leading-snug sm:text-2xl">{title}</h2>',
    1,
)

nutrition = r'''function NutritionReview({ variant }: { variant: string }) {
  if (variant === "error") {
    return (
      <Page title="Your Nutrition" titleSize="compact">
        <AppStatePanel
          state="error"
          title="Nutrition Couldn't Be Loaded"
          description="We couldn't confirm your account or load your saved nutrition targets. Nothing was changed."
          action={<Action>Try Again</Action>}
        />
        <p className="mt-4 text-sm text-[var(--pu-text-secondary)]">
          Still not working? <span className="font-semibold text-[var(--pu-text-primary)] underline underline-offset-4">Sign in again.</span>
        </p>
      </Page>
    );
  }

  if (variant === "locked") {
    return (
      <Page
        kicker="Your Nutrition"
        title="Simple Targets That Fit Your Plan"
        description="Nutrition guidance unlocks with an eligible paid program."
        titleSize="compact"
      >
        <AppStatePanel
          state="locked"
          title="Not Unlocked"
          description="Included with the 28-Day Fat Loss Accelerator."
          action={<Action>Explore the Accelerator</Action>}
        />
      </Page>
    );
  }

  if (variant === "welcome") {
    return (
      <Page
        kicker="Nutrition"
        title="Calories Matter. Protein First. Meals Stay Simple."
        description="Build starting targets, see how they fit across your normal day, and repeat meals that work. No food logging required."
        titleSize="compact"
      >
        <div className="max-w-lg">
          <Action>Set Up My Starting Targets</Action>
          <a
            href="https://genxjumps.com/nutrition/"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"
          >
            Learn the nutrition basics on Gen X Jumps
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </div>
      </Page>
    );
  }

  if (variant.startsWith("setup")) {
    const step = variant === "setup-2" ? 2 : variant === "setup-3" ? 3 : 1;
    return <NutritionSetupReview step={step} />;
  }

  const targets = [
    ["Calories", "2,100"],
    ["Protein", "175 g"],
    ["Carbs", "210 g"],
    ["Fat", "62 g"],
  ] as const;
  const meals = [
    ["Breakfast", "25%", "525 cal · 44 g protein"],
    ["Lunch", "25%", "525 cal · 44 g protein"],
    ["Dinner", "50%", "1,050 cal · 87 g protein"],
  ] as const;

  return (
    <Page
      title="Your Nutrition"
      description="These are the numbers to follow each day. Hit your calorie and protein targets consistently to lose fat and protect muscle."
      titleSize="compact"
    >
      {variant === "review" ? (
        <AppNotice tone="warning">
          <strong className="text-[var(--pu-text-primary)]">Your Weight Changed</strong>
          <span className="mt-1 block">Review the proposed update before anything changes.</span>
          <span className="mt-2 block">Calories: 2,100 to 2,040 · Protein: 175 g to 170 g</span>
        </AppNotice>
      ) : null}

      <section className="border-b border-[var(--pu-border-subtle)] pb-6 sm:pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">Starting Targets</h2>
            <p className="mt-2 text-base leading-relaxed">
              These are your numbers for the whole day. Every meal counts. All seven days count.
            </p>
          </div>
          <Button type="button" variant="outline">Update Targets</Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--pu-border-subtle)] py-5 sm:grid-cols-4">
          {targets.map(([label, value]) => (
            <div key={label}>
              <p className="text-2xl font-extrabold leading-tight sm:text-3xl">{value}</p>
              <p className="mt-1 text-sm font-bold text-[var(--pu-text-secondary)]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[var(--pu-border-subtle)] py-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-accent-program)]">Your Normal Day</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
              See how the numbers work across your day.
            </h2>
          </div>
          <Button type="button" variant="outline" size="sm">Adjust Your Day</Button>
        </div>
        <p className="mt-3 text-base leading-relaxed">
          Adjust the split to match how you actually eat. This changes the split, not your daily totals.
        </p>
        <AppList className="mt-5">
          {meals.map(([meal, percentage, detail]) => (
            <AppListRow key={meal} title={meal} detail={detail} end={<span className="font-bold">{percentage}</span>} />
          ))}
        </AppList>
      </section>

      <section className="border-b border-[var(--pu-border-subtle)] py-6 sm:py-8">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-accent-program)]">Build Meals That Work</p>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">Keep the food simple.</h2>
        <p className="mt-3 text-base leading-relaxed">
          Start with protein. Use labels, serving sizes, and standard nutrition information to fit the rest of each meal to its numbers.
        </p>
      </section>

      <section className="border-b border-[var(--pu-border-subtle)] py-6 sm:py-8">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-accent-program)]">My Normal Day</p>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">I keep the structure and adjust the extras.</h2>
        <p className="mt-3 text-base leading-relaxed">
          Most meals can stay familiar. Reduce the extras that push calories up while keeping the protein-centered structure.
        </p>
      </section>

      <section className="border-b border-[var(--pu-border-subtle)] py-6 sm:py-8">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-accent-program)]">Read The Label</p>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">Check what you drink and what you pour.</h2>
        <p className="mt-3 text-base leading-relaxed">
          Drinks, dressings, oils, cheese, sauces, and serving sizes can add up fast. Check the label and measure when needed.
        </p>
      </section>

      <section className="border-b border-[var(--pu-border-subtle)] py-6 sm:py-8">
        <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">If You Miss</h2>
        <p className="mt-2 text-base leading-relaxed">
          One meal does not need to become a lost day. Make the next choice better and keep going.
        </p>
      </section>

      <section className="border-b border-[var(--pu-border-subtle)] py-6 sm:py-8">
        <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">If results stall</h2>
        <p className="mt-2 text-base leading-relaxed">
          Review labels, portions, drinks, sauces, serving sizes, calorie-dense foods, and consistency before rebuilding the whole diet.
        </p>
      </section>

      <a
        href="https://genxjumps.com/nutrition/"
        target="_blank"
        rel="noreferrer"
        className="mt-5 flex items-center justify-between gap-4 border-y border-[var(--pu-border-subtle)] py-5 font-semibold"
      >
        <span>
          <span className="block text-xl font-extrabold leading-tight">Learn the basics</span>
          <span className="mt-1 block text-xs font-normal text-[var(--pu-text-secondary)]">
            Deeper nutrition explanations and examples on Gen X Jumps.
          </span>
        </span>
        <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      </a>
    </Page>
  );
}'''
text = replace_block(text, "function NutritionReview", "function NotificationsReview", nutrition)

notifications = r'''function NotificationsReview({ empty }: { empty: boolean }) {
  return (
    <Page
      kicker="Account"
      title="Notifications"
      description="Program reminders and important account updates live here."
      titleSize="compact"
    >
      {empty ? (
        <AppStatePanel
          state="empty"
          title="You're All Caught Up"
          description="New reminders will show here."
        />
      ) : (
        <AppList>
          {[
            { title: "Your next workout is ready", body: "Day 3 - Jump + Strength", time: "Today" },
            {
              title: "Review your nutrition targets",
              body: "Your latest weight may change your daily numbers.",
              time: "Yesterday",
            },
          ].map((item) => (
            <AppListRow
              key={item.title}
              title={<span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[var(--pu-action-primary)]" aria-hidden="true" />{item.title}</span>}
              detail={item.body}
              end={<span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--pu-text-secondary)]">{item.time}</span>}
            />
          ))}
        </AppList>
      )}
    </Page>
  );
}'''
text = replace_block(text, "function NotificationsReview", "function AccountReview", notifications)

path.write_text(text)

# Replace brittle review-only visual assertions with contracts for the current shared system.
test_path = Path("src/lib/__tests__/app-review.test.ts")
test = test_path.read_text()

def replace_test(name: str, next_name: str, body: str):
    global test
    start = f'  it("{name}"'
    end = f'  it("{next_name}"'
    a = test.find(start)
    if a < 0:
        raise SystemExit(f"Missing test: {name}")
    b = test.find(end, a)
    if b < 0:
        raise SystemExit(f"Missing next test after {name}: {next_name}")
    test = test[:a] + body.rstrip() + "\n\n" + test[b:]

replace_test(
    "uses one focused email-access design for both Welcome email states",
    "focuses the Home Screen prompt on the install action",
    r'''  it("uses one focused email-access design for both Welcome email states", () => {
    const emailStates = reviewScreens.filter(
      (screen) => screen.slug === "welcome-email-sent" || screen.slug === "welcome-returning",
    );

    expect(emailStates.map((screen) => screen.variant)).toEqual(["sent", "returning"]);
    expect(welcomeReviewSource).toContain('returning ? "Welcome Back" : "Check Your Email"');
    expect(welcomeReviewSource).toContain('returning ? "Send Another Link" : "Open My Email"');
    expect(welcomeReviewSource).toContain("<SetupProgress currentStep={2}");
    expect(welcomeReviewSource).toContain("size-6 text-[var(--pu-action-primary)]");
    expect(welcomeReviewSource).toContain("text-3xl font-extrabold leading-tight sm:text-4xl");
    expect(welcomeReviewSource).not.toContain("relative mx-auto mb-7 h-16 w-20");
    expect(welcomeReviewSource).not.toContain("gxj-display-title");
  });''',
)

replace_test(
    "focuses the Home Screen prompt on the install action",
    "gives the Accelerator an aqua identity without mixing in the 7-Day orange accent",
    r'''  it("focuses the Home Screen prompt on the install action", () => {
    expect(planReadyReviewSource).toContain("Todd, Keep Your Comeback One Tap Away");
    expect(planReadyReviewSource).toContain("Add to My Home Screen");
    expect(planReadyReviewSource).toContain("<Download");
    expect(planReadyReviewSource).toContain("No app store required.");
    expect(planReadyReviewSource).toContain("Not Now - View My Plan");
    expect(planReadyReviewSource).not.toContain("min-h-20 w-full justify-between");
    expect(planReadyReviewSource).not.toContain("rounded-full bg-background text-gxj-orange");
    expect(planReadyReviewSource).not.toContain("gxj-display-title");
  });''',
)

replace_test(
    "uses the approved direct-on-page Progress treatment in review and production",
    "uses the approved direct Nutrition target instruction in review and production",
    r'''  it("uses the approved direct-on-page Progress treatment in review and production", () => {
    expect(progressReviewSource).toContain('titleSize="compact"');
    expect(progressReviewSource).toContain('title="Your Progress"');
    expect(progressReviewSource).toContain("<AppLinearProgress");
    expect(progressReviewSource).toContain('accent="aqua"');
    expect(progressReviewSource).toContain("border-y border-[var(--pu-border-strong)]");
    expect(progressReviewSource).toContain("Latest Measurements");
    expect(progressReviewSource).not.toContain("gxj-display-title");
    expect(progressReviewSource).not.toContain("h-3 overflow-hidden bg-foreground/15");
    expect(progressRouteSource).toContain('titleSize="compact"');
    expect(progressRouteSource).toContain('title="Your Progress"');
    expect(progressRouteSource).toContain("border-y border-[var(--pu-border-strong)]");
    expect(progressRouteSource).toContain("Latest Measurements");
    expect(progressRouteSource).toContain("<AppLinearProgress");
    expect(progressRouteSource).not.toContain("gxj-display-title text-4xl sm:text-5xl");
  });''',
)

replace_test(
    "uses the approved direct Nutrition target instruction in review and production",
    "exposes the real pre-setup Nutrition entry state for review",
    r'''  it("uses the approved direct Nutrition target instruction in review and production", () => {
    const instruction =
      "These are the numbers to follow each day. Hit your calorie and protein targets consistently to lose fat and protect muscle.";
    expect(nutritionReviewSource).toContain(instruction);
    expect(nutritionRouteSource).toContain(instruction);
    expect(activeNutritionReviewSource).toContain('title="Your Nutrition"');
    expect(activeNutritionReviewSource).toContain('titleSize="compact"');
    for (const content of [
      "Starting Targets",
      "Update Targets",
      "Your Normal Day",
      "Adjust Your Day",
      "Build Meals That Work",
      "My Normal Day",
      "Read The Label",
      "If You Miss",
      "If results stall",
      "Learn the basics",
    ]) {
      expect(activeNutritionReviewSource).toContain(content);
      expect(nutritionRouteSource).toContain(content);
    }
    expect(activeNutritionReviewSource).toContain("grid grid-cols-2 gap-x-6 gap-y-5 border-y");
    expect(activeNutritionReviewSource).toContain("text-sm font-bold text-[var(--pu-text-secondary)]");
    expect(activeNutritionReviewSource).toContain("<AppList");
    expect(activeNutritionReviewSource).not.toContain("gxj-display-title");
    expect(activeNutritionReviewSource).not.toContain("rounded-lg border border-border bg-card");
    expect(nutritionResultsSource).toContain("text-2xl font-extrabold leading-tight sm:text-3xl");
    expect(nutritionResultsSource).toContain("border-b border-[var(--pu-border-subtle)]");
    expect(nutritionResultsSource).toContain("grid grid-cols-2 gap-x-6 gap-y-5 border-y");
    expect(nutritionResultsSource).not.toContain("gxj-display-title");
    expect(nutritionRouteSource).toContain('<AppNotice tone="warning"');
    expect(nutritionRouteSource).toContain("<AppStatePanel");
    expect(nutritionRouteSource).toContain("<AppLoadingState");
  });''',
)

test = test.replace(
    'expect(nutritionSetupReviewSource).toContain("border-t-2 border-foreground/20 py-6 sm:py-8");',
    'expect(nutritionSetupReviewSource).toContain("border-t border-[var(--pu-border-subtle)] py-6 sm:py-8");',
    1,
)

test_path.write_text(test)

state_path = Path("CURRENT_STATE.md")
state = state_path.read_text()
old = '''- Reconcile the review catalog with the real Precision Utility production components so review
  scenarios cannot silently drift from participant-facing routes.'''
new = '''- Finish reconciling specialized synthetic review scenarios after the core Home, onboarding,
  Progress, Nutrition, and Notifications review states are aligned with production patterns.'''
if old not in state:
    raise SystemExit("Missing review catalog open-work line")
state = state.replace(old, new, 1)
old_active = '''The Precision Utility participant-facing production-route migration is complete at this checkpoint.
Welcome and assessment completion now use shared loading/state treatment, compact setup progress,
restrained Barlow hierarchy, direct page structure, and bounded notices instead of the superseded
display-title, large progress-tile, and card-by-default presentation. Signup handoff, assessment,
plan generation, save, replacement, recovery, and token behavior remain unchanged. Internal
review/preview/admin surfaces and the public sales page are separate follow-up surfaces rather than
participant design authority.'''
new_active = '''The Precision Utility participant-facing production-route migration is complete. Review-catalog
reconciliation is now the active internal design checkpoint. Core synthetic Home, onboarding,
Progress, Nutrition, and Notifications scenarios are being rebuilt with the same shared state, list,
progress, button, typography, and structural patterns used by production. Review remains fake-data
only and cannot redefine participant-facing design. Customer routes and behavior are outside this
checkpoint.'''
if old_active not in state:
    raise SystemExit("Missing current active checkpoint text")
state_path.write_text(state.replace(old_active, new_active, 1))
