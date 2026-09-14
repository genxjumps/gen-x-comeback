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

### 5. Internal and review-only screens

These don't belong in the customer information architecture or visual navigation:

- `/admin/customers`
- `/admin/refunds`
- `/preview/w01`
- `/preview/accelerator`
- API, email-return, signup-return, and release endpoints

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

## Representative screens for the first visual pass

### Home

Use Home to establish the app shell, global navigation, page spacing, Today's priority card, and
secondary summary cards.

### Assessment Step 3

Use Step 3 to establish the focused setup shell, form controls, optional-field treatment, short-page
placement, and mobile keyboard behavior.

### Day 1 workout

Use Day 1 to establish workout hierarchy, preparation boxes above the video, video treatment,
detailed circuit reference, and the primary completion action.

Approve these three patterns before applying the system to the remaining screen families.

## Recommended next action

Design Home first, but include the participant-app header and mobile bottom navigation in that
checkpoint. Once that shell is approved, apply it to the 7-Day plan and workout pages before styling
the rest of their content.
