# Gen X Jumps App Design System

**Role:** Design system

This document contains the shared presentation rules for the customer-facing app. Route-specific
checkpoint history and review scenarios are preserved in
[`history/APP_MAP_AND_DESIGN_SYSTEM.md`](history/APP_MAP_AND_DESIGN_SYSTEM.md).

## Visual foundation

- Use warm cream and paper-toned backgrounds, black and charcoal structure, warm neutrals, and
  orange as the main action color.
- Green and mint are not primary interface colors. Use functional success, warning, or error colors
  only when the meaning requires them.
- Aqua is a bounded Accelerator accent. It does not replace orange as the app-wide action color.
- Use Anton for display type and Barlow for interface and body type.
- Keep hard edges, strong geometric blocks, and restrained distressed or halftone texture. Texture
  must never reduce the readability of copy or controls.
- Preserve the existing Gen X Jumps wordmark until a separate logo decision is approved.

## Governed presentation primitives

Shared visual decisions live in reusable code before they are repeated on routes.

- `PlatformPage` owns the standard customer page frame, app-page H1 scale, introduction copy, and
  page-header spacing.
- `SectionTitle` owns the standard customer section-heading treatment.
- `BodyText`, `SupportingText`, and `MetaText` define the normal body, supporting, and metadata
  hierarchy.
- `PageSection` owns the standard strong divider and vertical section rhythm.
- `ContainedPanel` is the default contained treatment when content genuinely needs a boundary.
- `Button` owns normal page-action appearance. Standard page actions are 56 px high, uppercase
  Anton, and orange by default. Small utility actions remain compact Barlow controls.
- `SetupProgress` owns numbered setup/progress segments. Do not recreate its completed/current/
  upcoming treatment on individual routes.

A route may compose these primitives, but it should not paste a local copy of their class list.
When a shared visual decision changes, update the primitive so every real use can inherit it.
Existing routes are migrated to these primitives in bounded design checkpoints rather than by
changing unrelated screens opportunistically.

## Shared page structure

- Home, Programs, Progress, Nutrition, Account, Notifications, the 7-Day plan, Accelerator,
  recovery, focused setup, and status pages use the same tokens and spacing system.
- `PlatformPage` uses the compact app-page title scale and 16 px introduction copy. Only a true
  public landing-page hero or intentionally dominant Home state may request the larger hero scale.
- The shared shell does not create page-top spacing. The page header owns that space.
- Ordinary navigation and summary content sits directly on the page with dividers. Use a contained
  panel only for content needing containment, such as a form control, status, warning, video, or
  interactive tool.
- Background, typography, buttons, spacing, navigation, and reusable components apply across
  routes. A page does not create a local substitute for a shared rule.

## Typography hierarchy

- App-page H1: Anton, uppercase, compact scale from `PlatformPage`.
- Hero H1: Anton, uppercase, reserved for true landing-page or intentionally dominant Home hero
  treatment.
- Section heading: `SectionTitle`.
- Body copy: 16 px Barlow with comfortable leading.
- Supporting copy: 14 px Barlow using the shared muted foreground.
- Metadata/status labels: 12 px bold uppercase Barlow with restrained tracking.
- Do not create one-off opacity levels or font sizes merely to make one route look approximately
  like another route. Use the nearest semantic level above.

## Navigation and actions

- Permanent member navigation is Home, Programs, Progress, and Nutrition.
- Account and Notifications are persistent utilities.
- Public, focused-setup, and participant-app shells may expose different navigation, but they use
  the same header system and visual foundation.
- Primary and secondary buttons come from the shared button component. Standard page actions are
  56 px high, use uppercase Anton, and preserve a minimum touch target.
- Small utility controls may use the compact shared button size when the action is subordinate,
  such as edit, remove, dismiss, or preference toggles.
- Destructive, disabled, loading, and confirmation treatments must communicate their meaning in
  text as well as color.

## Sections and containment

- Standard content sections use strong horizontal dividers and shared vertical rhythm rather than
  being wrapped in cards by default.
- Use `ContainedPanel` only when containment improves meaning or interaction - forms, warnings,
  status messages, video/media, confirmations, or interactive tools.
- Do not add a box solely to make a section look designed.
- Repeated lists and summaries should prefer direct-on-page rows with dividers unless each item is
  genuinely an independent interactive object.

## Forms and progress

- Questions and supporting copy sit directly on the cream page between strong dividers.
- Choice controls and inputs receive boundaries because they are interactive. Do not wrap an entire
  question or step in an extra card.
- Multi-step forms use `SetupProgress`: completed is black, current is orange, and upcoming is
  outlined and ghosted.
- Choices stack on mobile. Short choices may use two columns at wider sizes when readability is
  preserved.
- Selected controls use the approved orange marker, light highlight, and restrained offset shadow.
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
must not become a second implementation of the customer interface. Each visual checkpoint migrates
only the routes explicitly included in its approved scope.
