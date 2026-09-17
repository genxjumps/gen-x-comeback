# Gen X Jumps App Design System

**Role:** Design system

## Current authority

The approved visual direction is **Precision Utility**.

The existing customer-facing routes remain the functional product reference, but their current
visual implementation is **not** the design authority. They will be migrated only after the new
component system is approved.

Historical route-specific design decisions and prior visual experiments remain preserved in
[`history/APP_MAP_AND_DESIGN_SYSTEM.md`](history/APP_MAP_AND_DESIGN_SYSTEM.md) for reference only.
They do not override this document.

## Design intent

Precision Utility is a clean, capable, high-clarity fitness interface. It should feel current,
competent, and physically active without drifting into senior-fitness styling, decorative wellness,
or generic sports-tech gloss.

The interface gets personality from strong type hierarchy, disciplined spacing, useful contrast,
Gen X Jumps copy, photography, and selected high-impact brand moments. Ordinary app screens should
not compete with their content.

## Color foundation

Use semantic color roles instead of arbitrary route-level colors or opacity values.

| Role | Value | Use |
| --- | --- | --- |
| Page surface | `#F5F2EA` | Default app background |
| Contained surface | `#FFFFFF` | Forms, media, warnings, confirmations, interactive containment |
| Subtle surface | `#EAE6DD` | Selected/quiet utility backgrounds |
| Primary text / structure | `#171717` | Main text and strong structure |
| Secondary text | `#5C5851` | Supporting copy and metadata |
| Subtle border | `#CDC7BC` | Ordinary component boundaries |
| Strong border | `#242321` | Section rules and strong control boundaries |
| Primary action | `#C94F16` | Main CTA, focus identity, active setup step |
| Primary action hover | `#B94712` | Hover/pressed primary action state |
| Primary action tint | `#F8E8DF` | Selected control background |
| Program accent | `#167A86` | Bounded Accelerator/program context |
| Program accent tint | `#E2F0F2` | Program-accent background when needed |
| Success | `#2F6F4E` | Actual successful outcome only |
| Warning | `#8A6500` | Actual warning state only |
| Danger | `#A43B31` | Actual error/destructive state only |

Orange is functional, not decorative. Aqua is a bounded program accent and never competes with the
primary CTA. Green, amber, and red are reserved for their semantic meanings.

## Typography

Barlow is the primary interface and heading family.

Anton is no longer the default app-heading font. Reserve it for the Gen X Jumps wordmark and rare
brand-impact or campaign moments after explicit approval.

| Role | Desktop | Mobile | Weight |
| --- | --- | --- | --- |
| Hero | 56/54 | 44/42 | 800 |
| H1 | 40/40 | 32/34 | 800 |
| H2 | 28/30 | 28/30 | 800 |
| H3 | 20/24 | 20/24 | 700 |
| Body | 16/24 | 16/24 | 400-500 |
| Supporting | 14/20 | 14/20 | 400-500 |
| Metadata | 12/16 | 12/16 | 700, uppercase |

Do not create route-specific font sizes or text opacities to approximate another screen.

## Spacing and layout

Use a 4 px base unit and the approved spacing scale:

`4, 8, 12, 16, 24, 32, 48, 64, 80`

Default horizontal gutters:

- Mobile: 20 px
- Tablet: 32 px
- Desktop: 40 px

Content widths:

- App maximum: 1120 px
- Reading/form maximum: 720 px

The layout is mobile-first. Desktop is an expanded composition, not the source layout squeezed down.

## Borders, radius, elevation, and icons

Structure comes primarily from alignment, spacing, contrast, and rules.

- Structural radius: 0 px where appropriate.
- Control radius: 4 px.
- Contained panel radius: 8 px.
- Subtle elevation: `0 1px 2px rgb(23 23 23 / 8%)`.
- Overlay elevation: `0 10px 28px rgb(23 23 23 / 10%)`, reserved for overlays.
- Default icon size: 20 px.
- Navigation icon size: 24 px.
- Default icon stroke: approximately 1.8 px.

Avoid gratuitous shadows, glass effects, broad gradients, and pill-shaped treatment as a default.

## Buttons and actions

One component system governs actions across routes.

- Compact utility action: 40 px minimum height.
- Standard action: 48 px minimum height.
- Major action: 52 px minimum height.
- Minimum touch target: 44 by 44 px.
- Primary action: orange fill with white text.
- Secondary action: contained surface with strong border.
- Quiet action: transparent with subtle border.
- Disabled state remains legible and clearly inactive.
- Keyboard focus uses a visible 3 px orange ring with a 3 px offset.

Do not create route-specific button systems.

## Forms and choices

Questions and explanatory copy sit directly on the page when they do not require containment.
Interactive controls receive boundaries because they are interactive.

- Inputs use the standard 48 px control height.
- Selected choices use an orange boundary, light orange tint, and restrained shadow.
- Form help text uses the approved supporting hierarchy.
- Do not wrap every question in a card.

## Progress

Progress is compact, obvious, and subordinate to the task.

- Completed segments use primary structure color.
- Current segment uses orange.
- Upcoming segments use the subtle surface.
- Progress numbers stay at the information hierarchy appropriate to their content.
- Do not enlarge a percentage merely because it summarizes progress.

## Navigation

Permanent member navigation remains Home, Programs, Progress, and Nutrition. Account and
Notifications remain persistent utilities.

Navigation uses a restrained utility treatment with clear active state, adequate touch targets, and
visible focus treatment. Different routes do not invent their own navigation styling.

## Containment

Direct-on-page content is the default.

Use contained panels when containment improves meaning or interaction, including:

- forms
- warnings and errors
- confirmation states
- video/media
- interactive tools
- grouped settings that genuinely belong together

Do not add a box solely to make a section look designed.

## Status states

Color supports meaning. Text carries meaning.

Success, warning, error, locked, loading, empty, and completed states must communicate their meaning
in clear language and not rely on color alone.

## Motion and accessibility

- Control transitions: 120 ms.
- Panel/overlay transitions: 180 ms.
- Avoid decorative motion longer than 250 ms.
- Respect `prefers-reduced-motion`.
- Target WCAG 2.2 AA: 4.5:1 for normal text and 3:1 for large text and UI boundaries.
- Preserve visible keyboard focus on every interactive control.
- Minimum touch target: 44 by 44 px.

## Explicitly avoid

- Multiple competing accent colors on one screen.
- 13 px body copy or faint low-contrast explanatory text.
- Cards as the default page-layout device.
- Pill-shaped treatment on ordinary controls.
- Oversized progress numbers without information value.
- Decorative gradients, glass effects, or soft senior-wellness visual language.
- Different button, heading, form, or spacing systems for different routes.

## Implementation boundary

The new implementation lives under `src/design-system/precision/` until the component system is
approved.

The current app components and routes must not be restyled opportunistically during this phase.
The hidden `/design-system` route is a noindex component showcase only. It exists to review the real
new components before any customer-facing route migration begins.

After the production component showcase is approved, migration will happen by design-system
primitive across the app, not by redesigning pages one at a time.

Customer-facing copy continues to use **workout**, not **assignment**.
