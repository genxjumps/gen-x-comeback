# Gen X Jumps App Map and Design-System Starting Point

Status: structural design reference. The participant-shell recommendation is implemented in the
first Home visual checkpoint.

This document maps the current customer-facing app, identifies the global interface pieces that
must remain consistent, and separates structural decisions from later visual styling.

## Primary customer navigation

The persistent app navigation has four destinations:

| Destination | Customer job                       | Primary content                                                                      |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Home        | Know what to do next               | Today's workout or next action, plus program, progress, and nutrition summaries      |
| Programs    | Access what I own                  | 7-Day plan, 28-Day Accelerator, setup, pause/resume, history, and available programs |
| Progress    | See whether the work is paying off | Program completion, measurements, and progress history                               |
| Nutrition   | Know what to eat                   | Calorie and macro targets, meal structure, and adjustment guidance                   |

Account and Notifications are persistent utilities, not primary navigation destinations.

### Account menu

- My Account
- Get a Magic Access Link
- Log Out
- Purchases and Billing from the account screen

### Notifications

- Program reminders
- Unread state
- Mark one or all as read
- Notification preferences

## Customer journey map

### 1. Public entry and assessment

| Screen                   | Route                  | Purpose                                                                   | Structural family |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------- | ----------------- |
| Free offer               | `/`                    | Explain the 7-Day Comeback Plan and begin                                 | Public entry      |
| Before You Start         | `/assessment/start`    | Confirm basic eligibility                                                 | Focused setup     |
| Assessment Steps 1-3     | `/assessment`          | Collect current ability, impact, equipment, schedule, and optional weight | Focused setup     |
| Assessment result        | `/assessment/complete` | Show the personalized preview and save/replace the plan                   | Focused setup     |
| Welcome and email states | `/welcome`             | Confirm email delivery or recovery path                                   | Focused setup     |
| Home Screen prompt       | `/plan-ready`          | Offer quick Home Screen access before entering the plan                   | Focused setup     |

### 2. The free 7-Day plan

| Screen                  | Route                 | Purpose                                                       | Structural family       |
| ----------------------- | --------------------- | ------------------------------------------------------------- | ----------------------- |
| Plan overview           | `/your-plan`          | Show Today, Schedule, Plan Tips, and Change My Answers        | Participant app         |
| Workout or recovery day | `/your-plan/day/:day` | Prepare for and complete the day's workout or recovery action | Participant app         |
| Jump-rope guide         | `/jump-ropes`         | Help the participant choose a rope                            | Participant app support |

The plan overview and day screens are core owned-program screens. They should feel like part of the
same app as Home, Programs, Progress, and Nutrition rather than like a continuation of the signup
funnel.

### 3. Programs and the 28-Day Accelerator

| Screen                   | Route                             | Purpose                                                        | Structural family           |
| ------------------------ | --------------------------------- | -------------------------------------------------------------- | --------------------------- |
| My Programs              | `/my-programs`                    | Show owned, active, paused, completed, and available programs  | Participant app             |
| Program catalog redirect | `/programs`                       | Route into the available-program experience                    | Participant app             |
| Accelerator offer        | `/programs/accelerator`           | Explain and sell the Accelerator inside the app                | Participant app offer       |
| Purchase confirmation    | `/checkout/accelerator/success`   | Confirm ownership or recover a delayed purchase record         | Participant app transaction |
| Accelerator setup        | `/my-programs/accelerator/setup`  | Explain the program and collect optional starting measurements | Participant app setup       |
| Accelerator program      | `/accelerator`                    | Show today's workout and 28-day progress                       | Participant app             |
| Accelerator history      | `/my-programs/accelerator/runs`   | Preserve completed or replaced program history                 | Participant app support     |
| Refund request           | `/my-programs/accelerator/refund` | Route to the purchase refund workflow                          | Account support             |

### 4. Progress, Nutrition, and Account

| Screen                | Route                    | Purpose                                                     | Structural family   |
| --------------------- | ------------------------ | ----------------------------------------------------------- | ------------------- |
| Progress              | `/progress`              | Show completions and measurements                           | Participant app     |
| Nutrition             | `/nutrition`             | Set targets and show the participant's normal-day structure | Participant app     |
| Notifications         | `/notifications`         | Show reminders and preferences                              | Participant utility |
| Account               | `/account`               | Show identity and account actions                           | Participant utility |
| Purchases and Billing | `/account/purchases`     | Show purchases and refund access                            | Participant utility |
| Access recovery       | `/recover` and `/return` | Restore password-free access                                | Recovery            |

For an active Nutrition profile, the page gives a direct instruction: **These are the numbers to
follow each day. Hit your calorie and protein targets consistently to lose fat and protect
muscle.** Do not weaken this with optional or pass-or-fail framing. Setup retains its own
setup-specific explanation until targets exist.

### 5. Internal and review-only screens

These don't belong in the customer information architecture or visual navigation:

- `/admin/customers`
- `/admin/refunds`
- `/preview/w01`
- `/preview/accelerator`
- `/review`
- `/review/:screen`
- API, email-return, signup-return, and release endpoints

`/review` is the design and copy review index. Each child URL renders a fixed, fake-data customer
state without authentication, server reads, browser storage, or account mutations. The review
screens reuse the app's shared background, typography, button, spacing, divider, workout-media,
and navigation treatments so app-wide decisions can be evaluated together. They are hidden from
customer navigation and marked `noindex`.

## Shell decision

The current code uses two different page shells:

1. The full platform shell with desktop navigation, mobile bottom navigation, Account, and
   Notifications.
2. A narrow shell for assessment, onboarding, the 7-Day plan, Jump Ropes, the Accelerator offer,
   and purchase confirmation.

That split creates inconsistent navigation and makes global actions easier to lose.

### Recommended structure

Use one shared header system with three deliberate modes:

| Mode            | Used for                                                                                  | Persistent elements                                                             |
| --------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Public          | Free offer and recovery                                                                   | Gen X Jumps identity and the minimum relevant account action                    |
| Focused setup   | Eligibility, assessment, welcome, and Home Screen prompt                                  | Gen X Jumps identity and Account; no primary navigation until the plan is ready |
| Participant app | Home, 7-Day plan, workouts, Programs, Accelerator, Progress, Nutrition, and support pages | Primary navigation, Account, and Notifications                                  |

The 7-Day plan and workout pages use Participant app mode. Their internal links -
Today, Schedule, Plan Tips, and Change My Answers - remain local plan navigation, not global app
navigation.

## Global component inventory

### Navigation and page frame

- App header
- Desktop primary navigation
- Mobile bottom navigation
- Account menu
- Notification bell and unread state
- Standard page header: kicker, title, and optional description
- Focused-flow progress marker
- Local section navigation for long program pages

### Actions

- Primary button
- Secondary button
- Quiet text action
- Destructive or high-consequence action
- Disabled action
- Loading action
- Confirmation panel or modal

### Content containers

- Primary action card
- Program card
- Workout preparation card
- Information or coaching card
- Measurement card
- Offer and price card
- Empty state
- Loading state
- Locked state
- Completed state
- Warning state
- Error and retry state

### Forms

- Radio choice
- Checkbox choice
- Text and number input
- Select menu
- Unit control
- Inline validation
- Optional-field treatment
- Multi-step form controls

### Workout media

- Video thumbnail and player
- Locked-day cover
- Available-later cover
- Completed treatment
- Workout facts
- Jump-rope guidance
- Workout approach
- Equipment
- Detailed circuit reference
- Completion action

## Initial design-system scope

The first design pass needs decisions for:

- GXJ color roles, including background, surface, text, accent, success, warning, and error
- Display, heading, body, label, and supporting-text styles
- Page and section spacing on mobile and desktop
- Border, corner, and shadow rules
- Button hierarchy and minimum touch size
- Card hierarchy
- Form-control states
- Icon size and weight
- Video aspect ratio and cover treatment
- Progress bars and completion markers
- Loading, empty, locked, completed, warning, and error patterns

### Visual foundation

The numbered workout covers establish the app's visual direction:

- Warm cream backgrounds and paper-toned surfaces
- Black and charcoal for structure, type, borders, and navigation
- Orange as the main brand accent and action color
- Oversized condensed display type, hard edges, and strong geometric blocks
- Light distressed or halftone texture around the edges, never behind important copy or controls

Green and mint are not primary interface colors. Selected controls, progress, and primary actions
use the cream, black, and orange system. Functional colors remain available only when a state truly
needs a separate success, warning, or error meaning.

### Whole-app enforcement

- The existing Gen X Jumps wordmark treatment stays unchanged until a separate logo decision is
  approved.
- Cream, black, warm neutral, and orange are shared app tokens. Legacy teal and mint references
  resolve to this palette so old screens can't reintroduce green.
- Barlow is the shared interface typeface and Anton is the shared display typeface.
- Primary and secondary buttons come from the shared button component. Routes don't invent their
  own border weight or shadow treatment.
- Pages use one shared header, content width, texture, and section-divider system.
- The shared participant shell doesn't add top spacing. Each shared page header owns that spacing so
  screens don't accidentally stack two large blank areas above their content.
- Ordinary navigation and summary content sits directly on the page with soft dividers. A bordered
  container is reserved for something that needs containment, such as a form control, status,
  warning, video, or interactive tool.
- These rules apply to focused setup, the participant app, the 7-Day plan, workouts, Programs,
  Progress, Nutrition, Account, Notifications, recovery, and empty or error states.

## Representative screens for the first visual pass

### Home

Use Home to establish the app shell, global navigation, and page spacing. Today's workout and the
secondary summary links sit directly on the shared page background without a surrounding card.

### Approved free 7-Day intake

The eligibility screen at `/assessment/start` and the three-step free 7-Day intake at `/assessment`
use the same visual system as Home, the active 7-Day plan, and the workout pages while keeping the
focused setup shell appropriate to a form.

- Use the shared cream background, header treatment, compact page-title scale, typography, orange
  action color, content width, and spacing rhythm.
- Use three numbered progress segments above the title. Completed segments are black, the current
  segment is orange, and upcoming segments are ghosted. This mirrors the state logic of the 7-Day
  schedule without turning the tracker into a dominant graphic.
- Questions and supporting copy sit directly on the page with two-pixel dividers. Choice controls
  and the weight input receive borders because their contents require interaction boundaries.
- Choices stack in one column on mobile. Short choices may use two columns at wider sizes; long jump
  rope experience choices remain one column for readability.
- Selected answers use the orange marker, light highlighted background, and a small offset shadow
  that gives the interaction a subtle lift. Primary and secondary actions use the same button
  treatment established elsewhere in the app.
- Standard page actions use uppercase Anton at 20px in a 56px-high button. Major workout-launch
  actions use the same display face at a larger scale, preserving a clear action hierarchy.
- The eligibility question uses the same direct-on-page question, divider, choice-control, content
  width, and compact title treatment as the assessment. Its existing eligible and not-eligible copy
  and behavior remain unchanged.
- Review screens must use the exact live questions and answer choices. Do not replace them with
  shorthand questions or add measurements the intake does not collect. The free 7-Day intake asks
  for optional weight, not waist.
- Equipment answers personalize eligibility and plan construction according to the existing rules.
  An equipment choice does not authorize inventing equipment inside a workout description.
- The design is presentation only. Preserve validation, local draft saving, step recovery,
  submission, plan construction, and all intake access controls.
- This contract applies only to the free 7-Day intake. The 28-Day Accelerator setup at
  `/my-programs/accelerator/setup` is a separate product flow with separate questions, data, and
  behavior.

### Approved Welcome handoff

The primary setup state at `/welcome` uses the approved focused-setup visual system to bridge the
website opt-in and the free 7-Day intake without feeling like a separate experience.

- Keep the existing personalized headline, explanation, action copy, time estimate, and all live
  handoff and destination behavior unchanged.
- Use the shared cream background, restrained texture, compact page-title scale, Anton display
  type, Barlow interface type, orange action color, content width, and spacing rhythm.
- Show three large numbered progress segments in one row: **01 Access saved** is complete in black,
  **02 Quick setup** is current in orange with the approved small offset shadow, and **03 Plan
  ready** is upcoming with a ghosted outlined treatment.
- The progress segments communicate state through both number and text. Do not replace the number
  with a check mark, add decorative icons, or put the entire Welcome message inside a card.
- Use the shared 56px-high uppercase Anton action treatment for **Create My 7-Day Plan**.
- **Check Your Email** and **Welcome Back** use one shared email-access presentation: centered
  content, the compact page-title scale, a centered standalone black envelope with a slightly
  offset orange echo, and the shared 56px action treatment. The envelope has no surrounding box,
  circle, or card.
- The review hub preserves both approved email-access variants. The live route renders only the
  state produced by its existing signup and recovery logic; the design system does not create a new
  runtime state or change its wording or action.
- Existing loading, missing or expired signup, returning-participant, and saved-plan routing
  behavior remains intact.
- This is a presentation contract only. It does not alter signup security, consent, saved drafts,
  plan construction, or the separate 28-Day Accelerator setup.

### Approved Home Screen installation prompt

The `/plan-ready` screen is the final focused setup handoff before the participant enters the saved
plan. It uses the approved design from the isolated **Home Screen Prompt** review state.

- Keep the existing **Your Plan Is Ready** kicker, personalized **Keep Your Comeback One Tap Away**
  title, explanation, action copy, and destination behavior unchanged.
- Use the shared cream background, restrained texture, compact page-title scale, Anton display
  type, Barlow interface type, content width, and spacing rhythm established by Welcome and the
  participant screens.
- Do not repeat the numbered setup progress on this screen. The installation action is the focus,
  and the content sits directly on the page without a surrounding card.
- Use one dominant full-width black action rail for **Add to My Home Screen**. The label uses
  uppercase Anton, and the right edge contains a white circular field with the orange download icon.
- Keep **No app store required.** immediately below the primary action and preserve **Not Now - View
  My Plan** as a quiet secondary action that never blocks plan access.
- Show the existing iPhone, Android, or desktop instructions only after the participant selects the
  primary action when a native install prompt is unavailable.
- The installed confirmation may remain contained because it communicates a real status state.
- This is a presentation contract only. Preserve platform detection, install tracking, the 24-hour
  reminder delay, standalone routing, and all existing plan navigation behavior.

### Day 1 workout

Use the focused workout page to establish the shared workout hierarchy, media treatment, overview,
supporting information, and primary completion action. Additional workout information belongs
below the media treatment, not in preparation boxes above it.

### Active 7-Day plan review and approved schedule system

The active `/your-plan` review direction is the visual bridge between Home and the workout page. It
uses the compact page-title scale, shows progress without a surrounding card, and repeats the same
workout launch treatment used on Home. The seven-day schedule sits directly on the page with
dividers, clear day numbers, and distinct complete, current, and upcoming states. The approved
schedule treatment itself is implemented in both the review route and the real participant plan.

The schedule-state treatment is approved and shared by the review screen and production plan:

- Every row keeps one zero-padded day number. Do not replace completed-day numbers with check marks
  and do not repeat `Day N` beside the number.
- Completed rows ghost the number, saved title, state label, and arrow together so past work recedes
  without looking unavailable.
- The current row uses the orange number block and highlighted row treatment. Its live state label
  may say Today, Tomorrow, Next, or Upcoming according to the existing calendar behavior.
- Upcoming rows use solid black numbers and titles with no number container or row fill.
- The row renders the saved title supplied by the participant's plan. The same component must handle
  workout, walk or easy movement, recovery, rest, and all approved schedule templates without
  substituting content or changing progression rules.
- These are presentation rules only. They do not change the saved plan, assignment order,
  availability, completion, or update behavior.

### Approved Home and workout-page visual contract

The September 2026 visual review establishes the following shared pattern for the participant Home
and focused workout pages. These are presentation rules only. They do not change saved plans,
workout selection, workout content, equipment, timing, progression, locking, completion, or any
other product behavior.

- Use the same participant header, cream page background, restrained edge texture, content width,
  bottom navigation, dividers, typography families, and button treatment on both pages.
- Keep the existing Gen X Jumps wordmark treatment unchanged.
- Home uses **Today's Workout** as its page heading. It is visually prominent without competing
  with the workout title inside the launch card.
- The Home workout treatment is a special launch panel, not a miniature workout-detail page. It
  shows the live day label, saved workout title, numbered artwork, and one orange action rail. Do
  not add a redundant workout description beneath its title.
- **Your Gen X Jumps Fitness Hub** follows the launch panel and introduces the Programs, Progress,
  and Nutrition summary links. It is a section heading, so it remains smaller than the page heading
  while staying distinct from the row titles below it.
- The focused workout page repeats the live day label and saved workout title above the media card.
  This page-level title uses the compact scale approved during the Home-to-workout continuity
  review. The workout title inside the numbered media artwork remains visually strong.
- The workout media card uses the matching numbered artwork and an orange **Start Workout** rail
  when the existing workout state allows playback. Other rails continue to reflect the existing
  locked, available-later, completed, and replay states.
- **Workout Overview** appears immediately below the media card using the same section-heading
  scale as **Your Gen X Jumps Fitness Hub** and the same card-to-section spacing rhythm used on
  Home.
- The overview facts use the approved website-style grid treatment. A two-by-two arrangement is
  allowed on mobile but is not mandatory when the number or type of verified facts calls for a
  different responsive arrangement.
- Overview labels and values must stay simple and factual. Do not turn the overview into a list of
  workout movements or invent descriptive workout copy.
- Duration uses the measured Cloudflare video runtime for each workout: W01 15:05, W02 14:30, W03
  14:03, W04 14:03, W05 14:00, W06 14:29, and W07 14:09. Do not replace these with a generic
  15-minute estimate.
- Supporting workout information follows the media and overview. Do not use **Before You Start**,
  **Before You Press Play**, or **Set Yourself Up to Train Well** as section copy.
- Ordinary sections remain directly on the page with dividers. Do not add surrounding cards unless
  the content genuinely needs containment.
- Shared spacing and type tokens govern these relationships everywhere. Do not tune the same
  heading-to-card or card-to-section relationship independently on individual workout pages.
- The review hub exposes one isolated ready-state screen for each locked workout video, W01 through
  W07, so every workout treatment can be checked without an account or saved plan.

These Home and workout patterns, plus the active-plan schedule states, are approved. Apply their
shared components and tokens instead of recreating their presentation inside individual routes.

### Approved My Programs visual contract

The `/my-programs` screen continues the open, divided presentation established by the 7-Day
schedule while distinguishing the two program families without mixing their accent colors.

- Programs sit directly on the shared cream background. Use strong horizontal dividers instead of
  surrounding each program with a bordered, filled, or shadowed card.
- Each program begins with a duration marker. The marker reads **7 DAY** or **28 DAY**, so the
  adjacent title does not repeat the duration.
- Use **Comeback Plan** beside the **7 DAY** marker and **Fat Loss Accelerator** beside the **28
  DAY** marker.
- The 7-Day marker uses black and cream. The Accelerator marker and the active Programs navigation
  indicator use aqua with black. Do not place orange and aqua accents inside the same Programs
  composition.
- Keep the shared compact status label, Anton program title, Barlow supporting copy, and standard
  56px action treatment across not-started, active, paused, completed, and available states.
- Keep the page title on the established compact app-page scale. It must not use the oversized
  default hero treatment.
- Use one page heading: **Your Programs**. Do not add a Programs kicker above it or explanatory
  status copy below it. The navigation and program rows already provide that context.
- Confirmation prompts remain contained because they are consequential interaction states. Empty
  and informational copy stays directly on the page with dividers.
- These are presentation rules only. Preserve ownership, purchase, setup, activation, pause,
  resume, switching, history, completion, error, and navigation behavior.

### Approved 28-Day Accelerator dashboard visual contract

The active `/accelerator` dashboard uses the same workout-launch structure already approved for
the 7-Day experience. The shared structure creates continuity between programs, while the aqua
accent keeps the Accelerator visually distinct.

- Keep the established compact app-page title scale for **Fat Loss Accelerator** and show progress
  directly on the page without surrounding it with a card.
- Introduce the active assignment with **Today's Workout** at the shared section-heading scale.
- Use the exact approved 7-Day launch-card layout: black workout field, live day label and workout
  title on the left, distressed numbered artwork on the right, and one full-width action rail
  below it.
- The Accelerator version uses aqua anywhere the 7-Day version uses orange. Do not mix orange into
  the Accelerator launch card.
- The numbered artwork keeps the same composition, crop, distress, proportions, border, corner
  radius, and restrained offset shadow as the approved 7-Day artwork. Only the live day number and
  program accent change.
- The action reads **Open Today's Workout** and uses the shared white circular arrow treatment.
- Render the real assigned day number and saved workout title. The approved Day 9 **Workout B -
  EMOM** state is the visual reference, not hardcoded customer data.
- Do not add a workout description, movement list, or equipment summary inside the launch card.
  That information belongs on the focused workout page.
- Preserve all existing Accelerator assignment, unlock, recovery, completion, pause, and progress
  behavior. This is a presentation contract only.

### Approved 28-Day Accelerator workout-page visual contract

The real Accelerator day renderer uses the same focused workout hierarchy as the 7-Day pages for
every saved day and assignment combination.

- Repeat the live **Day N of 28** label and saved assignment title above the media treatment using
  the shared compact workout-page scale.
- Primary workouts use the shared numbered media card, enlarged day-label and workout-title scale,
  aqua action rail, and live day number. The same renderer covers Workouts A through E in all four
  weeks rather than recreating individual day pages.
- Completed, current, available-later, and locked workouts retain their existing access behavior
  while using the shared media-card state treatments. Cloudflare playback tracking continues to use
  the live enrollment and day.
- **Workout Overview** follows the media treatment and shows only factual saved information:
  measured runtime, program equipment, saved focus, and the format already present in the saved
  assignment label.
- Existing assignment instructions and recovery steps remain unchanged under **Workout Notes**.
  Do not introduce movement lists or new descriptive workout copy.
- Active-recovery and rest combinations keep their honest no-video treatment until verified media
  exists. Their saved instructions, acknowledgement behavior, schedule access, and progression stay
  unchanged.
- The shared component changes apply to the real `/accelerator` renderer, not only the isolated Day
  9 review state.

### Approved Progress visual contract

The real `/progress` page and all Progress review states reuse the progress and measurement language
already approved on the 28-Day Accelerator dashboard.

- Use the compact app-page title scale. Progress does not introduce another headline size.
- Use one page header: **Your Progress**. Do not place a black kicker above it or use a second
  motivational headline in its place. Empty and error messages belong in the content below.
- Put the current program, completion bar, latest measurements, detailed measurement controls, and
  history directly on the shared cream page background. Separate sections with the established
  strong and light divider rules instead of surrounding them with dashboard cards.
- Use orange for 7-Day completion and aqua for 28-Day Accelerator completion. Do not use the
  7-Day orange accent for Accelerator progress.
- Match the Accelerator dashboard meter exactly: the program label is a small uppercase kicker,
  the completion line and percentage use the same shared section-heading scale, and the aqua or
  orange bar is the established thicker square-ended treatment. A side-by-side percentage never
  grows larger than the completed-days number it summarizes.
- Present weight and waist as a simple two-column measurement readout using the established display
  type. Inputs and editing controls keep the boundaries required for interaction, but they do not
  create another outer card layer.
- Apply the same hierarchy to active, empty, history, and unavailable review states. Empty and error
  states retain their existing actions and wording.
- Preserve all loading, program selection, measurement saving, correction, removal, history, and
  navigation behavior. This is a presentation contract only.
