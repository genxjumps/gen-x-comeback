# Gen X Jumps 7-Day Plan App

This repository contains the mobile-first Gen X Jumps app that builds and delivers a personalized seven-day workout and protein plan.

The repository and Lovable project still use the historical working name `Gen X Comeback`. That is a project slug, not a locked public product title.

## Current status

The accepted synchronized source head is `eed6f82f1fa5a4354e103e7e3e93bea53b3ea914`. The Recovery request-boundary/RPC receiver repair is accepted, and all six V1 proactive lifecycle jobs plus user-requested Recovery have passed controlled real-provider staging.

The core seven-day plan experience is implemented and connected to Lovable Cloud. All six V1 proactive lifecycle jobs are implemented and accepted: Plan Ready, Start Day 1, Halfway, Stalled, Final Rescue, and Plan Completed. User-requested recovery is implemented and accepted separately as on-demand transactional product access; it is not a seventh proactive lifecycle email. Scheduler invocation plumbing is implemented and scheduler transport to the published application authentication boundary is verified. Lead-scoped fake-provider staging is accepted. All lifecycle jobs and recovery have passed lead-scoped real-provider staging through Resend, with signed-webhook delivery reconciliation and secure-link return verification for each job type. Plan Ready return tokens are directly associated with their originating Plan Ready `job_id`, and completed Plan Ready link exchanges preserve that job correlation. Recurring scheduling remains disabled and unconfigured. Production email sending remains intentionally disabled.

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
- Plan Ready return tokens associated with the originating Plan Ready job, with job-correlated link-exchange attribution
- Deliberate **Open My Plan** confirmation before a saved plan is activated
- Signed provider-webhook verification and event reconciliation
- Bounce and complaint suppression
- App-owned email preferences
- A release gate that blocks production provider calls unless every required setting and acceptance flag is present
- Controlled Start Day 1 dispatch using authoritative state immediately before any provider attempt
- Secure Start Day 1 return routing to `/your-plan/day/1`
- `START` for eligible unstarted Day 1, `RESUME` for eligible started-but-incomplete Day 1, and non-sendable `CANCEL` when the message should not be sent
- Server-authoritative Halfway job creation, dispatch validation, rendering, secure return, retry, suppression, and provider reconciliation
- Server-authoritative Stalled episode creation, cancellation, dispatch validation, rendering, secure return, retry, suppression, recurrence, and Final Rescue closure guards
- Server-authoritative Final Rescue job creation, four-day initial eligibility, five-day progress re-anchoring, Halfway priority, terminal inactivity closure, suppression, exact copy variants, secure return to `/your-plan`, and provider reconciliation
- Server-authoritative Plan Completed job creation at the final required-completion boundary, highest lifecycle priority, same-transaction cancellation of unfinished Start Day 1, Halfway, Stalled, and Final Rescue jobs, suppression, exact completion copy, and secure return to `/your-plan`
- User-requested recovery as a separate transactional-access job using the durable outbox, request-id idempotency, per-email and caller/IP rate limits, suppression checks, and a fresh recovery-purpose secure return token to `/your-plan`
- Vault-backed scheduler invocation plumbing through `public.invoke_email_dispatch_scheduler()` using `pg_net`, with recurring scheduling intentionally left disabled
- Lead-scoped fake-provider staging through `public.claim_email_jobs_for_lead(...)`, protected by a staging-only server flag and separate staging dispatch secret
- Fake-staging runtime that always uses the fake adapter, never instantiates Resend, skips the global stale-Plan-Ready alert sweep, and reports `sending_enabled:false`
- Separate lead-scoped real-provider staging protected by `EMAIL_REAL_STAGING_ENABLED`, a dedicated real-staging dispatch secret, an authoritative allowed-recipient value, and the same lead-scoped claim boundary
- Real-staging runtime that uses Resend only after staging authorization, lead scope, exact recipient allowlist, sender/provider, token/link, and webhook configuration checks pass while leaving the production sending gate unchanged

Plan Ready, Start Day 1, Halfway, Stalled, Final Rescue, and Plan Completed are the six implemented and accepted proactive lifecycle jobs. User-requested recovery is implemented and accepted separately as transactional product access. Marketing unsubscribe blocks Start Day 1, Halfway, Stalled, Final Rescue, Plan Completed, and promotional email without removing plan access or saved progress; it does not block a recovery explicitly requested by the user. Hard bounce or complaint suppression blocks recovery sending. Recovery does not require Plan Ready acceptance, remains available after plan completion, does not use lifecycle 24-hour spacing or inactivity caps, and does not cancel or control proactive lifecycle jobs.

Scheduler transport to the published application is verified. The published `gen-x-comeback.lovable.app` API path redirects to the canonical app host, so authenticated server-to-server dispatch targets `https://app.genxjumps.com/api/public/email/dispatch` directly to avoid losing the bearer header across a cross-host redirect. One synthetic Plan Ready job was fake-provider accepted through the lead-scoped staging path. A separate controlled real-provider staging checkpoint then sent exactly one Plan Ready message through Resend to the dedicated staging alias. Subsequent real-provider staging checkpoints completed Start Day 1, Halfway, Stalled, Final Rescue, Plan Completed, and Recovery. All of these jobs reached `provider_accepted` and reconciled to `delivered` through signed Resend webhooks. The secure Open My Plan link passed the raw-GET and deliberate-exchange smoke test for each applicable job, restoring the saved synthetic plan through a clean 303 redirect to `/your-plan` without changing progress. All synthetic rows, tokens, sessions, credentials, provider-event linkage, and temporary staging-only configuration were removed after each verification. No recurring email-dispatch cron job exists. Production email sending remains disabled.

### Accepted implementation baseline

- Accepted synchronized source SHA: `eed6f82f1fa5a4354e103e7e3e93bea53b3ea914`
- Previously accepted Plan Ready job-correlation repair implementation SHA: `e9601702f40a7d8a504593150e1e0dd2f1c7c193`
- Previously accepted real-staging implementation SHA: `78fca403187b928ea653f196d02978ab1c8160fe`
- Real-staging protected-file-restoration source: `3afe58587f8310fa6af5e05ff3a64f960bcdbe66`
- Recovery migration: `20260806215657_e52c4b4b-1c81-4e87-828d-81e9e8db23c4.sql`
- Scheduler foundation migration: `20260806224437_0f99de9f-07b7-46cf-909e-1b97a7ff8137.sql`
- Fake-staging scoped-claim migration: `20260806235258_0a429511-3eac-46f0-a264-bc1bbbe34551.sql`
- Real-staging checkpoint migration: none
- Plan Ready job-correlation repair migration: none
- `@lovable.dev/vite-tanstack-config`: exact version `2.8.5`
- `vite-plugin-hmr-gate`: resolved version `1.3.4`
- Approved formatted Supabase types blob: `dd7cbdb9cf0765396b647b8b2277751ddaf912bf`
- Protected route-tree Git blob: `221881b281bc3b37196e76a10876e8a332bedb34`
- Protected route-tree SHA-256: `28628c9df50d10af6236c9ebfd814ee56d84708194231b5fc34169afba5ed58d`
- Repository migrations: 18
- Live migration ledger: 18 matching versions

### Recovery verification evidence

- Focused recovery tests passed 29/29
- Affected return/email tests passed 53/53
- The full suite at recovery acceptance passed 393/393
- The full suite at the final two-send staging checkpoint passed 434/434 across 22 files
- TypeScript passed
- Production build passed
- Changed-file ESLint passed
- Prettier passed
- `git diff --check` passed
- The `/recover` route tree and protected route-tree blob/hash were verified
- The approved Supabase types blob remained protected
- Recovery request-boundary/RPC receiver repair is accepted; the route calls the Supabase client `rpc` method with proper SDK context, alphanumeric error-code sanitization, and server-only redacted diagnostics

### Scheduler and fake-staging evidence

- `public.invoke_email_dispatch_scheduler()` is implemented as a `SECURITY DEFINER` function
- PUBLIC, `anon`, and `authenticated` cannot execute the scheduler function
- `pg_cron` and `pg_net` are installed and Supabase Vault remains installed
- The scheduler function reads its dispatch URL and bearer secret from Vault and sends no customer data or PII
- Supabase → `pg_net` → published app → dispatch authentication boundary was verified
- `public.claim_email_jobs_for_lead(...)` provides an atomic lead-scoped claim path for staging while production keeps the existing global claim function
- Focused fake-staging tests passed 15/15
- Directly affected dispatch/config/runtime tests passed 53/53 at fake-staging acceptance
- Full suite passed 408/408 at fake-staging acceptance
- One synthetic Plan Ready job reached `provider_accepted` with `provider_key=fake`; all other lifecycle/recovery dispatchers claimed zero
- No other lead received a fake-provider job
- Synthetic lead/job/token/preference data and all temporary fake-staging credentials were removed after the live fake-staging pass

### First real-provider Plan Ready staging evidence

- Focused real-staging tests passed 15/15
- Fake-staging regression tests passed 15/15
- Directly affected dispatch/provider tests passed 34/34 across three files
- Full suite passed 423/423
- TypeScript and production build passed
- Changed-file ESLint passed with zero errors/warnings
- Prettier check and `git diff --check` passed
- Exactly one real provider send was performed, to the dedicated staging alias only
- Dispatch returned HTTP 200 with `mode=real_staging`, claimed exactly one Plan Ready job, and kept production `sending_enabled=false`
- Provider result reached `provider_accepted` with `provider_key=resend` and a provider message ID
- A signed Resend `email.delivered` event was received, matched, and reconciled; the job delivery state became `delivered`
- Direct Gmail inbox inspection was unavailable because the connected Gmail account was not the dedicated staging inbox; signed delivery plus the secure-link smoke test are accepted as sufficient evidence for this checkpoint
- Locked Plan Ready content was deterministically verified from the exact send inputs, including **Open My Plan** and exclusion of Accelerator promotion, assessment answers, weight, individualized protein target, and internal IDs
- Raw GET of the secure link was inert; deliberate exchange returned 303 to clean `/your-plan`, created the return session, restored the same saved plan, recorded the Plan Ready link-exchange event, created no duplicate plan, and changed no progress
- All synthetic records and temporary real-staging configuration were removed; the accepted source was republished afterward
- No recurring email-dispatch cron job exists
- Production email sending remains disabled

### Plan Ready job-correlation repair evidence

- Safety precheck found zero surviving Plan Ready jobs that had crossed a provider-attempt boundary or reached provider-accepted/delivered canonical state
- Plan Ready now uses the existing job-associated return-token path
- New Plan Ready return-token records preserve the originating Plan Ready `job_id`
- `email_plan_ready_link_exchange_completed` preserves the originating Plan Ready `job_id`
- The same logical Plan Ready job derives the identical return credential across retries
- Different logical job scope or plan version derives a different credential
- Raw GET remains inert; deliberate exchange still creates the expected return session and redirects cleanly to `/your-plan`
- Exchange does not alter plan progress
- Start Day 1 and recovery secure-link behavior remain unchanged
- Focused Plan Ready correlation tests passed 60/60 across five files
- Fake-staging regression tests passed 15/15
- Real-staging regression tests passed 15/15
- Affected return/email tests passed 56/56
- Full suite passed 430/430 across 22 files
- TypeScript, production build, changed-file ESLint, changed-file Prettier check, and `git diff --check` passed
- No migration was required
- No provider send occurred during the repair

Production email sending remains disabled. Recurring scheduling remains disabled and unconfigured. All lifecycle and recovery real-provider staging gates have passed. Remaining email-release work is: configure recurring scheduler and production dispatch secrets only after an explicit activation decision; then enable production sending only after a later explicit activation decision.

### Final two-send real-provider staging checkpoint evidence

- Starting synchronized SHA: `29488e9989f76d570faa6d36836f5df602a05ca7`; corrective restoration to accepted baseline produced SHA `eed6f82f1fa5a4354e103e7e3e93bea53b3ea914`
- Authorization preflight passed: POST with invalid `lead_plan_id` returned HTTP 400, `mode=real_staging`, `error=invalid_lead_plan_id`, claimed=0, zero provider attempts
- Cumulative controlled real-provider sends completed: 8
- **Scenario 1 (Plan Completed)**:
  - Synthetic plan fixture had exactly seven top-level days with optional W07 Active Recovery nested at Day 4 and not completed
  - All seven top-level days were completed sequentially through `public.complete_plan_day_atomic`
  - The final authoritative completion created exactly one `plan_completed` job and canceled/obsolete Start Day 1, Halfway, Stalled, and Final Rescue jobs
  - Authorized real-staging dispatch returned HTTP 200, `mode=real_staging`, `sending_enabled=false`, `plan_completed` claimed=1, all other lifecycle/recovery types claimed=0
  - Provider outcome was `provider_accepted` with `provider_key=resend` and a provider message ID; exactly one provider attempt
  - Locked rendering verified: personalized subject "Todd, you completed your 7-day plan"; preview "You finished what you started."; body order Hey Todd → "You did it. You completed every day in your 7-Day Comeback Plan." → "That means you worked, recovered, and kept coming back until the plan was done." → "Perfect wasn’t required. You finished."; CTA "View My Completed Plan"; post-CTA "Keep moving. Keep rebuilding. Stay capable."; sign-off "Move or Rust. / Todd / Gen X Jumps"; canonical `https://app.genxjumps.com` origin; no Accelerator, sales, assessment answers, weight, individualized protein, internal IDs, raw tokens, or customer-facing assignment
  - Signed Resend `email.delivered` event reconciled to the job/provider message ID
  - Secure-link smoke: raw GET inert; deliberate POST returned 303 to clean `/your-plan`; token removed from visible URL; authorized return session created; seven required completions unchanged; no duplicate plan; no progress mutation; `email_plan_completed_link_exchange_completed` recorded with the correct `job_id`
  - All Scenario 1 synthetic rows removed before Scenario 2
- **Scenario 2 (User-requested Recovery)**:
  - Fresh isolated synthetic plan created; `marketing_unsubscribed_at` active; no hard-bounce/complaint suppression
  - Plan Ready represented as `provider_accepted` for isolation only; all proactive lifecycle jobs canceled or non-claimable
  - Recovery created through the published `/recover` route: GET returned HTTP 200 with the heading "Get Back to Your Plan"; POST with the server-issued request ID returned HTTP 200 and the exact generic response "If that email matches a Gen X Jumps plan, a new link is on the way."
  - Exactly one pending recovery job created; exactly one `email_recovery_queued` event; correct current `lead_plan_id` and `plan_version_id`; unsubscribe did not block creation
  - Authorized real-staging dispatch returned HTTP 200, `mode=real_staging`, `sending_enabled=false`, `recovery` claimed=1, every proactive lifecycle type claimed=0
  - Provider outcome was `provider_accepted` with `provider_key=resend` and a provider message ID; exactly one provider attempt
  - Locked rendering verified: personalized subject "Todd, here’s a fresh link to your 7-day plan"; preview "Open your saved plan and pick up where you left off."; body order Hey Todd → "Here’s the fresh link you requested for your 7-Day Comeback Plan." → "Your plan and progress are still saved."; CTA "Open My Plan"; "This link opens your current saved plan on any device. No password needed."; sign-off "Move or Rust. / Todd / Gen X Jumps"; recovery footer "You received this because a fresh access link was requested for your Gen X Jumps plan."; canonical app origin; no Accelerator, marketing CTA, unsubscribe CTA, assessment answers, weight, individualized protein, internal IDs, raw tokens, or customer-facing assignment
  - Signed Resend `email.delivered` event reconciled to the recovery job/provider message ID
  - Secure-link smoke: token purpose `recovery`; raw GET inert; deliberate POST returned 303 to clean `/your-plan`; token removed; authorized session restored the current synthetic plan; no duplicate plan; no progress mutation; `email_recovery_link_exchange_completed` recorded with the correct recovery `job_id`
- Final cleanup: all Scenario 2 synthetic rows removed, including recovery rate-limit counters created by this test; `EMAIL_REAL_STAGING_ENABLED`, `EMAIL_REAL_STAGING_DISPATCH_SECRET`, and `EMAIL_REAL_STAGING_ALLOWED_RECIPIENT` deleted; application republished so the runtime cannot retain staging-enabled configuration; staging credential now returns 401 at runtime
- Zero synthetic staging residue remains: alias leads 0, jobs 0, tokens 0, access sessions 0, return sessions 0, canonical events 0, preference credentials 0, provider-event linkage 0, recovery rate-limit rows 0
- No recurring email-dispatch cron job exists; production email sending remains disabled; production scheduler secrets remain unconfigured; no production lifecycle email has been sent
- Remaining staging blockers: zero.

### Consent architecture (Recovery consent-state checkpoint)

Migration `20260807175301_630a998c-8645-4bfa-9f21-e0c0166d673e.sql` (applied live, forward-only) plus the follow-up function-grant lockdown establish two independent consent states on one lead identity. One normalized email address is exactly one identity, enforced by a unique index on `email_normalized`.

- **New-plan dual consent.** A new 7-Day Plan signup explicitly activates BOTH states with source `plan_signup` and fresh consent timestamps. The signup disclosure now covers Plan lifecycle email and general Gen X Jumps marketing email.
- **Plan email consent** (`plan_email_consent_active`, `_source`, `_at`, `plan_email_unsubscribed_at`) gates every proactive lifecycle email: Plan Ready, Start Day 1, Halfway, Stalled, Final Rescue, and Plan Completed. `/email-preferences` is now Plan-email-specific only: an unsubscribe stops all later proactive lifecycle email and permanently cancels every unsent proactive job, while leaving marketing consent untouched. Plan access is never revoked.
- **General marketing consent** (`marketing_consent_active`, `_source`, `_at`, `marketing_unsubscribed_at`) is stored and independently withdrawable but has no UI and no sending system. Nothing in the app reads it to send mail.
- **Recovery re-consent.** Recovery remains on-demand transactional product access and still sends the requested Recovery email. When Plan consent is inactive, one atomic boundary activates it with source `plan_recovery` and a fresh Plan consent timestamp, leaves marketing consent unchanged, and permanently cancels every unsent proactive lifecycle job created before that new boundary. When Plan consent is already active, Recovery does not refresh source or timestamp, does not cancel current jobs, does not restart the lifecycle, and does not touch marketing consent. Recovery never reactivates withdrawn marketing consent. The public response stays generic and non-enumerating for unknown, malformed, rate-limited, and replayed requests, and the exact subordinate disclosure "By recovering your plan, you agree to receive Gen X Jumps 7-Day Plan emails." is rendered beneath the Recovery action.
- **Authoritative dispatch fence.** Immediately after claiming and before any state resolution, rendering, credential derivation, or provider attempt, every proactive job is fenced: it may send only when Plan consent is active AND the job was created at or after the current Plan consent boundary. Older pending, retry_scheduled, expired-processing, overdue, and future-dated proactive jobs are closed as `canceled` and can never resurface or race through.
- **Deliverability suppression is separate and absolute.** Hard bounce and complaint suppression continues to block Recovery and every proactive lifecycle send. No consent change removes, bypasses, or weakens suppression, and the migration preserved every suppression record.
- **Pre-production backfill.** Every existing identity is a Todd-controlled test identity, so the migration backfilled all 19 identities active for both consent states with source `pre_production_test_backfill` and migration-time timestamps, and canceled every pre-migration nonterminal email job of every type. Completed jobs, canonical events, delivery evidence, reconciliations, historical staging evidence, and all contacts were preserved; nothing was deleted.


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

Production sending must stay disabled until domain authentication, sender configuration, webhook signing, dispatch authorization, safe preflight, return-flow inspection, all lifecycle/recovery real-provider staging, and all release gates are complete.

All lifecycle and recovery real-provider staging is now complete. Staging acceptance does not authorize production activation. Do not enable production outbound sending without an explicit activation decision. The server-side production sending gate must report every prerequisite satisfied before any production provider attempt is allowed.

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
