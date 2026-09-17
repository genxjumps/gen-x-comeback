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
- Use Anton for display type and Barlow for interface and body type.
- Keep hard edges, strong geometric blocks, and restrained distressed or halftone texture. Texture
  must never reduce the readability of copy or controls.
- Preserve the existing Gen X Jumps wordmark until a separate logo decision is approved.

## Shared page structure

- Home, Programs, Progress, Nutrition, Account, Notifications, the 7-Day plan, Accelerator,
  recovery, focused setup, and status pages use the same tokens and spacing system.
- `PlatformPage` uses the compact app-page title scale and 16 px introduction copy. Only a true
  public landing-page hero may request the larger hero scale.
- The shared shell does not create page-top spacing. The page header owns that space.
- Ordinary navigation and summary content sits directly on the page with dividers. Use a bordered
  container only for content needing containment, such as a form control, status, warning, video,
  or interactive tool.
- Background, typography, buttons, spacing, navigation, and reusable components apply across
  routes. A page does not create a local substitute for a shared rule.

## Navigation and actions

- Permanent member navigation is Home, Programs, Progress, and Nutrition.
- Account and Notifications are persistent utilities.
- Public, focused-setup, and participant-app shells may expose different navigation, but they use
  the same header system and visual foundation.
- Primary and secondary buttons come from the shared button component. Standard page actions are
  56 px high, use uppercase Anton, and preserve a minimum touch target.
- Destructive, disabled, loading, and confirmation treatments must communicate their meaning in
  text as well as color.

## Forms and progress

- Questions and supporting copy sit directly on the cream page between strong dividers.
- Choice controls and inputs receive boundaries because they are interactive. Do not wrap an entire
  question or step in an extra card.
- Multi-step forms use numbered progress segments: completed is black, current is orange, and
  upcoming is outlined and ghosted.
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
must not become a second implementation of the customer interface.
