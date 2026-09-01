# release/v1.1 preview review — Accelerator member experience

Preview commit reviewed: `c700af7b` (`release/v1.1`). No code, settings, data, or migrations were changed.

## What could not be reviewed, and exactly why

The Lovable browser session reports `signed_out`, and `src/components/platform-access-boundary.tsx` gates every member route on a Supabase session. `/home`, `/my-programs`, `/accelerator`, `/progress`, `/nutrition`, `/programs`, `/notifications` and `/my-programs/accelerator/runs` all render the "Private Access" wall instead of content. So the following were **not** visually verified and nothing about them is asserted below: live Workout A–E Cloudflare playback, real Daily Assignment day states, saved measurements, completion/repeat-run behavior, and 7-Day ↔ Accelerator switching. The only reviewable member-facing surface was the internal `/preview/accelerator` mock plus source reading.

## Blockers

1. **`/my-programs/accelerator/setup` crashes with HTTP 500 when `entitlement` is absent.** Verified: no search param returns 500 with the raw Zod payload (`"path": ["entitlement"], "message": "Required"`) in the error page; adding a UUID returns 200. Bookmarking, refreshing after a redirect, or arriving from history hard-crashes the first screen of a paid program and leaks validation internals. Needs a graceful redirect to `/my-programs` instead of a thrown search-validation error.
2. **Access-denied is a dead end.** The platform boundary screen offers no link or action — no recover link, no way back to a public entry. A member whose session lapses on mobile has nothing to tap, which will read as "my purchase is gone." The 7-Day denial screen does provide actions, so the two paths are inconsistent.
3. **The only unauthenticated review surface misrepresents the program.** `/preview/accelerator` shows "Cloudflare Stream ID pending" and "Runtime pending" for the daily workout, while `src/lib/accelerator/content.ts` carries real UIDs and runtimes for Workouts A–E. Anyone reviewing (or a member who reaches that route) sees a program that looks unbuilt. It also prints internal copy — "Final video-by-video audit is still required before launch" — which must not be visible in a member-facing route.

## Important fixes

4. **Placeholder media at the paid first impression.** Orientation ("Welcome From Todd"), the four weekly coaching videos, and Active Recovery F have no Cloudflare UID, so the setup screen's largest element is an empty dashed box directly above "Begin Day 1", and each week shows a coaching-video placeholder. Day 1 setup is the moment that must feel finished.
5. **Empty tabs sit in the primary 5-tab nav.** Nutrition is an explicit placeholder ("Nutrition guidance placeholder / No unapproved target formula is active"), Explore says enrollment is closed, Notifications says nothing has been activated. Three of six taps in the mobile bar lead to nothing. Either hide them for V1.1 or make the empty states state a clear "coming with" promise.
6. **Nav orientation is lost on Accelerator sub-routes.** `isActivePath` in `platform-shell.tsx` only special-cases `/accelerator`. On `/my-programs/accelerator/setup` and `/my-programs/accelerator/runs`, no tab is highlighted at all, so on mobile the member has no indication of where they are.
7. **Home does not reflect paused state.** Home's fallback card is generic ("Choose Your Current Program" → Open My Programs) and never mentions that an owned Accelerator run exists but is paused. A member who paused yesterday sees a home screen implying they own nothing in progress, contradicting My Programs.
8. **Home hero media area is a labelled empty box.** A full `aspect-video` dashed panel captioned with text like the current workout or rest-day guidance takes the top third of the mobile viewport and reads as a broken player rather than a deliberate summary.
9. **Undo window is invisible until it fails.** Measurement correction/removal only reports "The Undo window has ended" after the member taps. The remaining window should be visible while it is open.
10. **Locked future days show full instructions with locked media.** The assignment preview presents the workout detail while stating the video unlocks later, which is a mixed message about whether the day is available.
11. **Duplicate navigation landmark names.** Three regions share `aria-label="Main navigation"` (desktop nav, mobile bar, and one more), so screen-reader landmark navigation cannot distinguish them.

## Polish

12. Preview harness controls (six screen buttons plus five state buttons) wrap into ragged rows at 390px and are plain buttons with no selected semantics (`aria-pressed`/tablist).
13. Typography is inconsistent: hyphens used as dashes ("Weight - lb", "Run 1 - 12 of 28 days complete") alongside proper en dashes and curly apostrophes elsewhere; straight vs curly apostrophes mix across Home and My Programs.
14. Mobile label mismatch: bottom tab says "Programs" while the page title says "My Programs".
15. Measurement inputs are `type="number"` without `inputMode="decimal"`, so mobile keyboards and scroll-wheel behavior are not ideal for weight/waist entry.
16. "View Detailed History" in the preview implies a separate page while Progress uses an inline collapsible.

## Suggested next checkpoint scope (for approval, not yet implemented)

- Fix (1) with a search-validation fallback redirect and a route-level error component; fix (2) by giving the access wall a recover/entry action.
- Remove internal audit copy and pending-media wording from `/preview/accelerator`, or make it read from `content.ts`.
- Nav active-path mapping for Accelerator sub-routes; Home paused-run state; unique nav landmark labels; `inputMode` on measurement inputs.
- Decide separately (product call) on hiding Nutrition/Explore/Notifications and on the remaining unrecorded videos.

## Technical notes

- Crash source: `validateSearch: z.object({ entitlement: z.string().uuid() })` in `src/routes/my-programs.accelerator.setup.tsx` throws during SSR when the param is missing; `__root.tsx` `errorComponent` renders the raw message.
- Gating source: `platform-access-boundary.tsx` via `supabase.auth.getSession()` + `onAuthStateChange`.
- Video wiring: `src/lib/accelerator/content.ts` (A–E `uploaded`, orientation/weekly/F `pending_recording`), `src/lib/accelerator/video.ts`, `src/components/accelerator-video-tracker.tsx`.
