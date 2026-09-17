# Gen X Jumps App Design System

**Role:** Design system

This document contains the shared presentation rules for the customer-facing app. Route-specific
checkpoint history and review scenarios are preserved in
[`history/APP_MAP_AND_DESIGN_SYSTEM.md`](history/APP_MAP_AND_DESIGN_SYSTEM.md).

## Governing rule

A visual decision made for a reusable app element is an app-wide decision. Pages may compose shared
primitives differently, but they may not create local substitutes for page background, typography,
buttons, spacing, navigation, progress, form controls, section dividers, or contained panels.

If a route needs a genuinely different treatment, add a named shared variant and document the
reason. Do not solve a one-screen design problem by pasting a new cluster of utility classes onto
that screen.

## Visual foundation

- Use one warm cream/paper app background, black and charcoal structure, warm neutrals, and orange
  as the main action color.
- Aqua is a secondary program accent for the Accelerator where program identity needs distinction.
  It is not a second primary action color.
- Green and mint are not primary interface colors. Legacy `gxj-teal` references resolve to orange;
  legacy `gxj-mint` resolves to a warm highlight until those names can be retired safely.
- Use Anton for display type and Barlow for interface and body type.
- Keep hard edges, strong geometric blocks, and restrained distressed or halftone texture. Texture
  must never reduce the readability of copy or controls.
- Preserve the existing Gen X Jumps wordmark until a separate logo decision is approved.

## Shared page structure

- Home, Programs, Progress, Nutrition, Account, Notifications, the 7-Day plan, Accelerator,
  recovery, focused setup, and status pages use the same tokens and spacing system.
- `PlatformPage` is the default app-page wrapper. Its compact H1 is the standard app-page title.
  Only a true landing-page or deliberately approved hero may use the hero title scale.
- Compact page H1: Anton, uppercase, 30 px mobile / 36 px at `sm`, tight line height, shared tracking.
- Hero H1: Anton, uppercase, 48 px mobile / 72 px at `sm`.
- Section H2: Anton, uppercase, 24 px mobile / 30 px at `sm`.
- Form/question heading: Barlow bold, 20 px mobile / 24 px at `sm`.
- Body introduction: 16 px Barlow medium with relaxed line height.
- Supporting copy: 14 px Barlow using the shared muted foreground token.
- Metadata/status labels: 12 px bold uppercase with restrained tracking.
- The shared shell does not create page-top spacing. The page header owns that space.
- Ordinary navigation and summary content sits directly on the page with dividers. Use a bordered
  container only for content needing containment, such as a form control, status, warning, video,
  confirmation, or interactive tool.
- Standard section rhythm is a strong top divider with 24 px vertical padding on mobile and 32 px
  at `sm`.
- Standard contained panels use the app background, a restrained foreground border, and 16-20 px
  internal padding. White rounded cards are not the default page-content treatment.

## Shared primitives

- `PlatformPage` owns normal page width, header spacing, H1 treatment, introduction copy, and body
  width.
- `AppSection`, `AppSectionTitle`, `AppQuestionTitle`, `AppBody`, `AppSupportingText`, `AppMeta`, and
  `AppPanel` are the reusable content primitives for route composition.
- The shared `Button` owns app action typography, height, focus treatment, and core variants.
  Standard/default and large page actions are 56 px minimum height, Anton, uppercase, and use the
  shared orange action treatment. Small utility buttons remain Barlow and compact.
- Route code may add layout classes such as width or margin. It should not restate the primitive's
  font family, type scale, casing, height, background, or border treatment.

## Navigation and actions

- Permanent member navigation is Home, Programs, Progress, and Nutrition.
- Account and Notifications are persistent utilities.
- Public, focused-setup, and participant-app shells may expose different navigation, but they use
  the same header system and visual foundation.
- Primary, outline, destructive, disabled, loading, and confirmation actions come from the shared
  button component. Do not hand-build button-looking anchors or local button class recipes.
- Destructive, disabled, loading, and confirmation treatments must communicate their meaning in
  text as well as color.

## Forms and progress

- Questions and supporting copy sit directly on the cream page between strong dividers.
- Choice controls and inputs receive boundaries because they are interactive. Do not wrap an entire
  question or step in an extra card.
- Multi-step forms use the shared `SetupProgress` component. Completed is black, current is orange,
  and upcoming is outlined and ghosted. Use its labeled variant when the step names need to be
  visible.
- Choices stack on mobile. Short choices may use two columns at wider sizes when readability is
  preserved.
- Selected controls use the approved orange marker, light warm highlight, and restrained offset
  shadow.
- Progress numbers stay at the same visual scale as neighboring values or headings. Do not enlarge
  a percentage merely because it summarizes progress.

## Workout media and content states

- Video uses a responsive 16:9 area with consistent thumbnail, player, locked, available-later,
  completed, and pending treatments.
- Day labels and workout names remain live application text rather than being baked into cover art.
- Loading, empty, locked, completed, warning, and error conditions use shared components and plain
  customer language.
- Customer-facing copy uses **workout**, not **assignment**.

## Review discipline

Review routes are fixed fake-data scenarios, not product states. They must reuse real shared
components and remain hidden from customer navigation and search indexing. A review-only rendering
must not become a second implementation of the customer interface.

When a shared visual rule changes, inspect representative instances across the app rather than only
the screen where the decision originated.
