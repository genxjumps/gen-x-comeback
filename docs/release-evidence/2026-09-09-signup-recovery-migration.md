# Signup recovery migration application - September 9, 2026

## Approval and identity

Todd explicitly approved adoption and merge of PR #89 and execution under his
existing signup-recovery migration approval. PR #89 merged as
`ba530a1e62b6b83127e5be4385b3df9c514bb3a4`.
Its independent post-merge Quality Gate passed:
https://github.com/genxjumps/gen-x-comeback/actions/runs/34393326405

The single-migration procedure in `../CLOUD-MIGRATION-PROPOSAL.md` was adopted
for this operation. Its proposal-status wording records the pre-adoption state;
the explicit approval and completed operation are recorded here. It does not
authorize other migrations or relax the genuine-customer staging boundary.

- Lovable project: `9882f922-c17b-4fca-bd5b-48b9548e5322`
- Configured Supabase reference: `wrvjgjvdjjoytjdwntlx`
- Fresh Lovable source SHA matched the release SHA above.
- Application source fingerprint remained
  `sha256:0cec97593af87364ee44b48b29b5d6e7e6f1a97ed02e0c8df764216fe7324bd7`.
- Migration: `20260909190000_seven_day_signup_recovery.sql`
- Byte SHA-256:
  `a9a7d6a980875602100a8994deccef406162535976d58804e0f054f34be665e6`
- Statement SHA-256:
  `cea88a9c1cf006916cbf4dc5d8780b5133830af77fcebe993d2f8da2c496c752`
- Generated application-envelope SHA-256:
  `8be9b58dd95778769fc6cedbaef4145632230dde863f06a1ccb51f5474362a40`

## Preflight and execution

Migration integrity passed from the clean release checkout. Fresh remote history
contained 37 versions and exactly one pending migration. Existing names and
digests matched, with only the two specifically adopted legacy exceptions:
the empty `20260807193000` statement and the single leading newline in
`20260904110000`. Neither history row was changed.

A catalog query compared all 20 affected pre-existing functions and tables with
the canonical isolated replay. It covered function bodies, signatures, return
types, security, search paths and effective role privileges, plus table columns,
defaults, nullability, constraints, indexes, triggers, RLS, policies and grants.

The replay was configured with the observed Supabase default role grants.
PostgreSQL's version-dependent NOT NULL constraint catalog entries were excluded
from the constraint list; nullability was independently compared for every
column. With those explicit platform adjustments, the before catalogs matched
exactly. No unexplained schema drift remained.

A single-call temporary-table create/insert/rollback probe returned
`rollback_verified=true` and left no persistent object.

The exact generated application envelope was executed successfully in isolated
PostgreSQL first, with the observed ledger and operational-control fixtures.
The existing acceptance suite then passed after restoring its expected
disabled-sending fixture in that isolated database only. No fixture setup or
acceptance data was sent to the linked database.

One authenticated `query_database` call applied the envelope, including:

- One explicit transaction, advisory migration lock and exclusive ledger lock.
- Five-second lock timeout and 45-second statement timeout.
- Exact before-history, before-schema and operational-control assertions.
- The byte-exact canonical migration SQL.
- Expected after-schema assertions.
- An INSERT of the canonical version, name and byte-exact statement array.
- Exact after-history and unchanged-control assertions before commit.

The call returned `signup_recovery_migration_committed`. There was no retry,
history repair, backfill, or ad hoc application SQL.

## Independent results

Fresh queries after commit verified:

- All 38 migration entries are present and match the expected locked identities.
- All 37 prior rows are identical to their captured before-state.
- The new stored SQL digest matches the migration's byte SHA-256 exactly.
- All 34 affected post-migration catalog objects match the canonical replay.
- New row shapes match the replay underlying the deterministic additive types.
- New protected tables and RPCs retain the expected RLS and role permissions.
- The complete operational-control row digest is unchanged.
- Sending remains enabled; genuine 7-Day plans remain excluded; provider limit
  remains 10.
- Existing paid-access sending and customer-admission flags were already true
  and remain unchanged. They are distinct from public Accelerator enrollment
  and real-payment authorization; the source retains closed public enrollment
  and test-only Stripe checks.
- New sessions, welcome jobs and completed-run archives each contain zero rows.

## Boundaries and remaining work

No application publication, secret change, public intake opening, live test
email, or participant test-data creation occurred. A direct executor request
to the public release endpoint returned HTTP 403, so this operation does not
claim a fresh live application fingerprint verification.

The isolated engine is not a full Supabase staging environment. Deployed Auth,
scheduler delivery, real browser cookie transport and simultaneous database
clients still require the controlled acceptance checks documented in
`../SIGNUP-RECOVERY-CHECKPOINT.md`.

The next release action is separately approved publication through the existing
preflight and authenticated publisher. Controlled email/browser tests need their
own approval. The launch blocker is not closed by schema application alone.
