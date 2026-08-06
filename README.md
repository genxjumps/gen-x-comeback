# Gen X Jumps 7-Day Plan App

This repository contains the mobile-first Gen X Jumps app that builds and delivers a personalized seven-day workout and protein plan.

The repository and Lovable project still use the historical working name `Gen X Comeback`. That is a project slug, not a locked public product title.

## Current status

The accepted repository baseline is `debf3870ce544ffd0a06efe251e1402882865596`. The actual three-file repository repair is commit `edf8d00bee15f981b76de51b00f082bcd1218065`; `debf3870…` is an empty forward follow-up whose tree is the accepted current tree. GitHub `main` and Lovable were synchronized at `debf3870…` when the repair completed.

The core seven-day plan experience is implemented and connected to Lovable Cloud. Plan Ready, Start Day 1, Halfway, and Stalled are implemented; Stalled is accepted. Final Rescue, Plan Completed, user-requested recovery, and scheduler work have not started. Outbound email remains intentionally disabled. No deployment or publication occurred during the repository repair, and the older public deployment remains separate from the accepted repository baseline.

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

Plan Ready, Start Day 1, Halfway, and Stalled are implemented in the accepted repository baseline. Final Rescue and Plan Completed remain unimplemented. User-requested recovery follows the remaining proactive lifecycle work. Scheduler implementation and full lifecycle staging acceptance also remain outstanding. Broadcasts, newsletters, and promotional campaigns are outside the current app-email scope. Email sending remains disabled.

### Accepted repository baseline

- Accepted GitHub `main`: `debf3870ce544ffd0a06efe251e1402882865596`
- Actual three-file repair commit: `edf8d00bee15f981b76de51b00f082bcd1218065`
- Repaired files: `package.json`, `bun.lock`, and `src/integrations/supabase/types.ts`
- `@lovable.dev/vite-tanstack-config`: exact version `2.8.5`
- `vite-plugin-hmr-gate`: resolved version `1.3.4`
- Approved formatted Supabase types blob: `dd7cbdb9cf0765396b647b8b2277751ddaf912bf`
- Protected route-tree Git blob: `1c551e423ede445c42b1b83e0bfcf0a95f8c1675`
- Protected route-tree SHA-256: `91532a1d039d221efa0d6462facde203ae2d442e4b21c224ad9f416a4ed609d6`
- Repository migrations: 13
- The cumulative diff from `13d134639c7048aa6f6eede6a8d6b603c970d8af` contains exactly the approved 28 formatting files. It excludes `package.json`, `bun.lock`, `src/routeTree.gen.ts`, every migration, this repository `README.md`, the Product Blueprint, the Technical Specification, and the Decision Log.

### Verification evidence and qualification

Repository tree verification passed. The final isolated read-only verifier could not rerun Bun installation, formatting, lint, typecheck, build, or tests because that runtime lacked Bun, a mounted repository checkout, package access, and outbound network access. Acceptance relies on exact GitHub object-level reconciliation to the previously fully verified target tree and the prior successful verification evidence.

The prior successful exact-target evidence was:

- Frozen installation passed
- Installed dependencies were `@lovable.dev/vite-tanstack-config@2.8.5` and `@lovable.dev/vite-plugin-hmr-gate@1.3.4`
- Prettier passed
- ESLint passed with two existing `react-refresh/only-export-components` warnings
- `git diff --check` passed
- TypeScript passed
- Production build passed
- Focused lifecycle tests passed 202/202 across nine files
- Stalled Final Rescue guard tests passed 20/20
- The full suite passed 289/289 across 16 files
- The protected route-tree hash passed

These gates were not freshly rerun at `debf3870…` by the final isolated verifier.

Live operational counts were also not newly queried by the final isolated verifier. The last verified state remains 13 matching live migration-ledger records and zero email jobs, provider events, return tokens, operational alerts, and provider attempts.

Documentation reconciliation is the current checkpoint. It changes documentation only and does not begin Final Rescue, Plan Completed, user-requested recovery, scheduler implementation, email sending, deployment, or publication.

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
