# Gen X Jumps 7-Day Plan App

This repository contains the mobile-first Gen X Jumps app that builds and delivers a personalized seven-day workout and protein plan.

The repository and Lovable project still use the historical working name `Gen X Comeback`. That is a project slug, not a locked public product title.

## Current status

The accepted synchronized implementation baseline is `979883dc2caa1893c9a33383f6d381af1b4a1901`. GitHub `main` and Lovable are synchronized at that SHA.

The core seven-day plan experience is implemented and connected to Lovable Cloud. Plan Ready, Start Day 1, Halfway, Stalled, and Final Rescue are implemented and accepted. Plan Completed, user-requested recovery, and scheduler work have not started. Outbound email remains intentionally disabled. No deployment or publication occurred during the Final Rescue checkpoint.

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

Plan Ready, Start Day 1, Halfway, Stalled, and Final Rescue are implemented in the accepted repository baseline. Plan Completed remains unimplemented. User-requested recovery follows the remaining proactive lifecycle work. Scheduler implementation and full lifecycle staging acceptance also remain outstanding. Broadcasts, newsletters, and promotional campaigns are outside the current app-email scope. Email sending remains disabled.

### Accepted repository baseline

- Accepted GitHub `main`: `979883dc2caa1893c9a33383f6d381af1b4a1901`
- Final Rescue migration: `20260806175920_582a324d-47f9-44ac-aec4-1ad8b86eb7d6.sql`
- `@lovable.dev/vite-tanstack-config`: exact version `2.8.5`
- `vite-plugin-hmr-gate`: resolved version `1.3.4`
- Approved formatted Supabase types blob: `dd7cbdb9cf0765396b647b8b2277751ddaf912bf`
- Protected route-tree Git blob: `1c551e423ede445c42b1b83e0bfcf0a95f8c1675`
- Protected route-tree SHA-256: `91532a1d039d221efa0d6462facde203ae2d442e4b21c224ad9f416a4ed609d6`
- Repository migrations: 14
- Live migration ledger: 14 matching versions

### Final Rescue verification evidence

- Dedicated Final Rescue tests passed 42/42
- Affected lifecycle tests passed 255/255
- The full suite passed 331/331
- TypeScript passed
- Production build passed
- `git diff --check` passed
- The protected route-tree hash passed
- The approved Supabase types blob remained unchanged

The dispatch route was not separately included in the recorded ESLint and Prettier commands. The dedicated Final Rescue test file passed its recorded lint and format checks. Todd accepted this qualification as non-blocking.

Email sending remains disabled. No deployment or publication occurred. Final Rescue documentation reconciliation is the current checkpoint and does not begin Plan Completed, user-requested recovery, scheduler implementation, sending, deployment, or publication.

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
