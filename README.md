# Gen X Jumps 7-Day Plan App

This repository contains the mobile-first Gen X Jumps app that builds and delivers a personalized seven-day workout and protein plan.

The repository and Lovable project still use the historical working name `Gen X Comeback`. That is a project slug, not a locked public product title.

## Current status

The accepted synchronized implementation baseline is `2fa7866380c12280720a33abaa15af007a8b860d`.

The core seven-day plan experience is implemented and connected to Lovable Cloud. All six V1 lifecycle jobs are implemented and accepted: Plan Ready, Start Day 1, Halfway, Stalled, Final Rescue, and Plan Completed. User-requested recovery and scheduler work remain unstarted. Outbound email remains intentionally disabled. No deployment or publication occurred during the Plan Completed checkpoint.

### Implemented app experience

- Public offer and entry screen
- Multi-step fitness assessment
- Personalized results preview
- Lead capture and consent after the schedule preview
- Transactional persistence of the lead, assessment, consent, and current plan
- Deterministic workout and recovery-day assignments
- Immediate Day 1 access after a successful save
- Days 2-7 plan access and workout-day routes
- Saved-plan return access without requiring a password
- Plan progress and day-completion behavior
- Guided workout video delivery
- Post-plan jump-rope recommendation page
- Responsive mobile and desktop layouts
- PWA manifest and installable-app foundation

### Implemented email lifecycle foundation

- App-owned durable outbox
- Idempotent Plan Ready job creation
- Job leasing, retry handling, and stale-job alerts
- Replaceable delivery-provider adapter with Resend support
- Secure, purpose-limited return tokens
- Deliberate **Open My Plan** confirmation before a saved plan is activated
- Signed provider-webhook verification and event reconciliation
- Bounce and complaint suppression
- App-owned email preferences
- A release gate that blocks provider calls unless every required setting and acceptance flag is present
- Controlled Start Day 1 dispatch using authoritative state immediately before any provider attempt
- Secure Start Day 1 return routing to `/your-plan/day/1`
- `START` for eligible unstarted Day 1, `RESUME` for eligible started-but-incomplete Day 1, and non-sendable `CANCEL` when the message should not be sent
- Server-authoritative Halfway job creation, dispatch validation, rendering, secure return, retry, suppression, and provider reconciliation
- Server-authoritative Stalled episode creation, cancellation, dispatch validation, rendering, secure return, retry, suppression, recurrence, and Final Rescue closure guards
- Server-authoritative Final Rescue job creation, four-day initial eligibility, five-day progress re-anchoring, Halfway priority, terminal inactivity closure, suppression, exact copy variants, secure return to `/your-plan`, and provider reconciliation
- Server-authoritative Plan Completed job creation at the final required-completion boundary, highest lifecycle priority, same-transaction cancellation of unfinished Start Day 1, Halfway, Stalled, and Final Rescue jobs, suppression, exact completion copy, and secure return to `/your-plan`

Plan Ready, Start Day 1, Halfway, Stalled, Final Rescue, and Plan Completed are implemented and accepted in the current repository baseline. User-requested recovery and scheduler implementation remain outstanding. Marketing unsubscribe blocks Start Day 1, Halfway, Stalled, Final Rescue, Plan Completed, and promotional email without removing plan access or saved progress. Plan Ready and eligible user-requested recovery remain governed by their separate product-access rules. Broadcasts, newsletters, and promotional campaigns are outside the current app-email scope. Email sending remains disabled.

### Accepted repository baseline

- Accepted GitHub `main`: `2fa7866380c12280720a33abaa15af007a8b860d`
- Plan Completed migration: `20260806200433_cd9cb476-5061-494a-a66e-8e10b0f31dd5.sql`
- `@lovable.dev/vite-tanstack-config`: exact version `2.8.5`
- `vite-plugin-hmr-gate`: resolved version `1.3.4`
- Approved formatted Supabase types blob: `dd7cbdb9cf0765396b647b8b2277751ddaf912bf`
- Protected route-tree Git blob: `1c551e423ede445c42b1b83e0bfcf0a95f8c1675`
- Protected route-tree SHA-256: `91532a1d039d221efa0d6462facde203ae2d442e4b21c224ad9f416a4ed609d6`
- Repository migrations: 15
- Live migration ledger: 15 matching versions

### Plan Completed verification evidence

- Focused Plan Completed tests passed 33/33
- The full suite passed 364/364
- TypeScript passed
- Production build passed
- Changed-file ESLint passed
- Changed-file Prettier passed
- `git diff --check` passed
- The protected route-tree content and hash were restored and verified
- The approved Supabase types blob was restored and verified

Existing lifecycle tests passed within the 364/364 full suite. No separate affected-lifecycle command was recorded; this accepted verification qualification is not a blocker.

Email sending remains disabled. No deployment or publication occurred. Plan Completed documentation reconciliation is the current checkpoint and does not begin user-requested recovery, scheduler implementation, sending, deployment, or publication.

## Architecture

- **Frontend and server:** React 19, TypeScript, TanStack Start, and TanStack Router
- **UI:** Tailwind CSS 4 with Radix/shadcn-style components
- **Backend:** Lovable Cloud with PostgreSQL/Supabase-compatible services
- **Email transport:** Resend, used only as a replaceable delivery pipe
- **Testing:** Vitest
- **Hosting and project control:** Lovable
- **Version history:** GitHub, synchronized with the connected Lovable project

The app database is authoritative for plans, consent, email eligibility, job state, suppression, and send history. Email delivery must never control product access.

## Email release safety

Real sending must stay disabled until domain authentication, sender configuration, webhook signing, dispatch authorization, safe preflight, email preview, return-flow inspection, and staging acceptance are complete.

Do not enable outbound sending merely because a provider API key exists. The server-side sending gate must report every prerequisite satisfied before any real provider attempt is allowed.

## Local development

[Bun](https://bun.sh/) is recommended because this repository includes a Bun lockfile.

```sh
git clone https://github.com/genxjumps/gen-x-comeback.git
cd gen-x-comeback
bun install
bun run dev
```

Run the verification commands before committing application changes:

```sh
bun run test
bunx tsc --noEmit
bun run lint
bun run build
```

Keep server credentials and signing secrets out of source control.

## Lovable

- **Live app:** https://gen-x-comeback.lovable.app
- **Lovable editor:** https://lovable.dev/projects/9882f922-c17b-4fca-bd5b-48b9548e5322

Changes pushed to the connected `main` branch synchronize back to Lovable. Avoid force pushes, rebases, amendments, or squashes that rewrite published history.
