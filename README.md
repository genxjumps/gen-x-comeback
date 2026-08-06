# Gen X Jumps 7-Day Plan App

This repository contains the mobile-first Gen X Jumps app that builds and delivers a personalized seven-day workout and protein plan.

The repository and Lovable project still use the historical working name `Gen X Comeback`. That is a project slug, not a locked public product title.

## Current status

The accepted synchronized implementation baseline is `aff55ae6f4ca522e29d4e18b105296c8fbc72c63`.

The core seven-day plan experience is implemented and connected to Lovable Cloud. All six V1 proactive lifecycle jobs are implemented and accepted: Plan Ready, Start Day 1, Halfway, Stalled, Final Rescue, and Plan Completed. User-requested recovery is implemented and accepted separately as on-demand transactional product access; it is not a seventh proactive lifecycle email. Scheduler invocation plumbing is implemented and accepted, while recurring scheduling remains disabled and unconfigured. Outbound email remains intentionally disabled. No deployment or publication occurred during the scheduler-foundation checkpoint.

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
- Public `/recover` access flow with a generic non-enumerating response
- Saved-plan **Resend My Plan Link** action pointing to `/recover`
- Invalid, expired, or revoked return-link recovery pointing to `/recover`
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
- User-requested recovery as a separate transactional-access job using the durable outbox, request-id idempotency, per-email and caller/IP rate limits, suppression checks, and a fresh recovery-purpose secure return token to `/your-plan`
- Vault-backed scheduler invocation plumbing through `public.invoke_email_dispatch_scheduler()` using `pg_net`, with recurring scheduling intentionally left disabled

Plan Ready, Start Day 1, Halfway, Stalled, Final Rescue, and Plan Completed are the six implemented and accepted proactive lifecycle jobs. User-requested recovery is implemented and accepted separately as transactional product access. Marketing unsubscribe blocks Start Day 1, Halfway, Stalled, Final Rescue, Plan Completed, and promotional email without removing plan access or saved progress; it does not block a recovery explicitly requested by the user. Hard bounce or complaint suppression blocks recovery sending. Recovery does not require Plan Ready acceptance, remains available after plan completion, does not use lifecycle 24-hour spacing or inactivity caps, and does not cancel or control proactive lifecycle jobs. Scheduler invocation plumbing is implemented, but no recurring email-dispatch cron job or scheduler Vault secrets are configured yet. Controlled staging scheduler execution is next. Broadcasts, newsletters, and promotional campaigns remain outside the current app-email scope. Email sending remains disabled.

### Accepted implementation baseline

- Accepted synchronized implementation SHA: `aff55ae6f4ca522e29d4e18b105296c8fbc72c63`
- Recovery migration: `20260806215657_e52c4b4b-1c81-4e87-828d-81e9e8db23c4.sql`
- Scheduler foundation migration: `20260806224437_0f99de9f-07b7-46cf-909e-1b97a7ff8137.sql`
- `@lovable.dev/vite-tanstack-config`: exact version `2.8.5`
- `vite-plugin-hmr-gate`: resolved version `1.3.4`
- Approved formatted Supabase types blob: `dd7cbdb9cf0765396b647b8b2277751ddaf912bf`
- Protected route-tree Git blob: `221881b281bc3b37196e76a10876e8a332bedb34`
- Protected route-tree SHA-256: `28628c9df50d10af6236c9ebfd814ee56d84708194231b5fc34169afba5ed58d`
- Repository migrations: 17
- Live migration ledger: 17 matching versions

### Recovery verification evidence

- Focused recovery tests passed 29/29
- Affected return/email tests passed 53/53
- The full suite passed 393/393
- TypeScript passed
- Production build passed
- Changed-file ESLint passed
- Prettier passed
- `git diff --check` passed
- The `/recover` route tree and new protected route-tree blob/hash were verified
- The approved Supabase types blob remained protected

### Scheduler foundation evidence

- `public.invoke_email_dispatch_scheduler()` is implemented as a `SECURITY DEFINER` function
- PUBLIC, `anon`, and `authenticated` cannot execute the scheduler function
- `pg_cron` and `pg_net` are installed and Supabase Vault remains installed
- The scheduler function reads its dispatch URL and bearer secret from Vault and sends no customer data or PII
- No recurring email-dispatch cron job exists
- No `email_dispatch_url` or `email_dispatch_secret` Vault secret was inserted by the scheduler-foundation checkpoint
- No application environment secret changed
- `git diff --check` passed

Email sending remains disabled. Recurring scheduling remains disabled and unconfigured. Controlled staging scheduler execution is the next release checkpoint, followed by lifecycle/recovery staging verification. Real sending requires later explicit approval after all release gates pass. No deployment or publication occurred during the scheduler-foundation checkpoint.

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
