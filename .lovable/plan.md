# Stalled implementation checkpoint (plan only)

Starting point: commit `1403a81`. No code, migration, data, config, sending, or deployment change in this pass.

## Blocking conflict requiring Todd's approval

**One Stalled job per plan version is currently impossible.** The live `email_jobs` table has:

```text
CREATE UNIQUE INDEX email_jobs_logical_key
  ON public.email_jobs (job_type, plan_version_id, job_version);
```

The approved Stalled contract requires a distinct durable episode per newly completed required day
(`stalled:{plan_version_id}:after_day:{n}:v1`), i.e. up to six logical Stalled jobs per plan version.
The current index allows exactly one, so the contract cannot be implemented without changing this
live object. Both existing enqueue paths (`enqueue_start_day_1_for_plan_ready`,
`complete_plan_day_atomic`) rely on `ON CONFLICT (job_type, plan_version_id, job_version)` inference,
so the change touches live functions that were previously corrected and frozen.

Proposed minimal change, pending approval:

- Replace `email_jobs_logical_key` with a partial unique index carrying the predicate
  `WHERE job_type <> 'stalled'`, and update the two existing `ON CONFLICT` clauses to include the
  same predicate so inference still matches. Behaviour for Plan Ready, Start Day 1, Halfway, Plan
  Completed, and Final Rescue is byte-for-byte unchanged.
- Stalled episode uniqueness then rests on the already-existing global `idempotency_key UNIQUE`,
  which is exactly the logical episode key.

Alternative if Todd prefers not to alter the existing index: add a nullable episode discriminator
column and a second unique index scoped to Stalled only. This leaves `email_jobs_logical_key` intact
but adds a column to the shared table. I need a decision before implementation.

Secondary items to confirm (non-blocking):

- Stalled candidate creation and "newer required completion cancels earlier unsent candidate" belong
  inside the already-corrected `complete_plan_day_atomic`. That means editing a frozen live function.
  If Todd prefers, the Stalled logic can live in a separate `create_stalled_candidate` function called
  from the same atomic boundary, keeping the Halfway body untouched.
- `EmailJobStatus` in `src/lib/email/types.ts` omits `manual_review`, which the database enum has.
  Stalled reuses the shared parking path, so no change is required; noting the existing mismatch only.

## Implementation plan (small, testable, in order)

### 1. Contract constants (no behaviour)

`src/lib/email/types.ts`: add `STALLED_JOB_TYPE`, `STALLED_JOB_VERSION`, `STALLED_TEMPLATE_VERSION`,
`STALLED_DELAY_MS` (48h), `STALLED_MIN/MAX_REQUIRED_DAY` (1..6), `FINAL_RESCUE_JOB_TYPE`.

### 2. Pure resolver

New `src/lib/email/stalled-resolver.ts`, modelled exactly on `halfway-resolver.ts`, returning the
discriminated union `SEND | DEFER | CANCEL | SUPPRESS`. Gate order: canonical job (type/version/
template) -> current plan version -> Plan Completed control -> Final Rescue sent -> recipient present
-> required completions in 1..6 and plan incomplete -> episode is current (no newer required
completion) -> unsubscribe/suppression -> 48h elapsed from persisted `completed_at` -> Plan Ready
accepted and 24h lifecycle spacing (DEFER only) -> inactivity cap (3 accepted) -> SEND.

New `src/lib/email/stalled-state.server.ts`: read-only loader, mirroring `halfway-state.server.ts`,
reusing `requiredDayNumbers`. No personal data beyond recipient presence.

### 3. Template

New `src/lib/email/stalled-template.ts`, structured like `halfway-template.ts`, with the exact
approved subject/preview/greeting/body/CTA/close copy and the exact recovery footer line
"Lost access to your plan? Recover it here and pick up where you left off." as a plain-text secondary
link with no embedded token. `renderStalled` returns null for any non-SEND resolution.

### 4. Canonical events and secure return flow

- `src/lib/email/event-names.ts`: add the `stalled` prefix and omit `manual_review` (the eight
  approved events only), same as Halfway.
- `src/lib/email/link-exchange-event.ts`: add the Stalled contract entry, emitting
  `email_stalled_link_exchange_completed` only for a deliberate valid `open_plan` exchange of a
  canonical `stalled` / `v1` / `stalled_v1` job matching the validated lead and plan version.
- `src/lib/email/return-destination.ts`: Stalled stays on the closed default `/your-plan`; comment
  updated to name Stalled explicitly. No new destination, no URL data, no progress mutation.

### 5. Dispatch

- `src/lib/email/dispatch.ts`: add `dispatchStalledJobs` with `loadStalledState`, reusing the shared
  claim, `guardCommon`, job-scoped `issueCredentials(..., true)`, fenced `deferSend` (no retry event,
  no provider call) and `attemptSend`.
- `src/routes/api/public/email/dispatch.ts`: insert Stalled between Halfway and Start Day 1.

### 6. Migration (not applied in this pass)

One new migration file that: adjusts the logical-key uniqueness per the approved option; extends the
completion boundary to create/replace Stalled candidates anchored to persisted `completed_at + 48h`
for required days 1-6 (never Day 7, never optional Active Recovery), cancel earlier unsent candidates
on newer required progress, and emit `email_stalled_queued` only for the transaction that creates the
job; and cancels Stalled candidates on reassessment/plan replacement inside `commit_plan_version`.
Grants and RLS unchanged (service-role only).

### 7. Tests

- New `src/lib/email/__tests__/stalled-resolver.test.ts`: every gate, priority precedence (Plan
  Completed wins over missing recipient and suppression), DEFER-only spacing, no-repeat after
  acceptance, cap, Final Rescue closure.
- New `src/lib/email/__tests__/stalled-template.test.ts`: exact copy assertions, recovery line,
  null for non-SEND.
- New `src/lib/email/__tests__/stalled-dispatch.test.ts`: repeated deferral leaves `attempt_count`
  unchanged and emits no event, one provider attempt counts once, terminal SUPPRESS leaves access and
  progress untouched.
- New `src/lib/email/__tests__/stalled-job-creation.test.ts`: episode key shape, Day 7 creates none,
  newer completion supersedes an unsent candidate, replay completion creates nothing.
- Extend `link-exchange-attribution.test.ts` and `return-exchange.test.ts` with the fourth distinct
  attribution path and its mismatch cases; existing Halfway/Start Day 1/Plan Ready coverage unchanged.
- Regression: full suite, TypeScript, changed-file ESLint/Prettier, `git diff --check`,
  `src/routeTree.gen.ts` unchanged.

## Out of scope

Final Rescue, Plan Completed, user-requested recovery, scheduler enablement, deployment, publication,
production sending, spec/decision-log updates, and unrelated cleanup. Sending stays disabled.
