# Proposed controlled Cloud migration procedure

Status: proposal only. This file does not authorize execution or override the
current migration rules. Todd must explicitly adopt this procedure and approve
its PR merge before it can be used. His existing approval to apply the signup
recovery migration remains valid once the adopted preconditions pass.

## Problem and verified access

The current release is `faa267d4376a81d71a4a78e5dee8a723840c67a3` (PR #88).
Its independent Quality Gate passed in run `34392048812`.
Lovable reports the same source SHA for project
`9882f922-c17b-4fca-bd5b-48b9548e5322`, whose Cloud database is enabled.
The repository config identifies Supabase reference `wrvjgjvdjjoytjdwntlx`.

The connected tool catalog exposes authenticated `get_database_status` and
`query_database`, including schema changes. It exposes no database-password
retrieval, PostgreSQL connection provisioning, or Supabase CLI linking operation.
This executor has no Supabase CLI, Docker, or configured database credentials.
Installing the CLI alone wouldn't establish authorized database access.

Lovable's official MCP documentation explicitly supports SQL schema changes
through `query_database`. Its Cloud and Advanced settings documentation does not
document a direct CLI connection setup. This establishes an available SQL route;
it does not prove that direct access is impossible or constitute a support reply.
No support message was sent and no credential was extracted or changed.

Sources inspected September 9, 2026:

- https://docs.lovable.dev/integrations/lovable-mcp-server
- https://docs.lovable.dev/features/cloud
- https://docs.lovable.dev/features/advanced-settings

## Exact proposed exception

Adoption would permit only migration
`20260909190000_seven_day_signup_recovery.sql` on the existing controlled
pre-launch backend, using the authenticated Lovable database tool as transport
for reviewed Git SQL. It would not permit Lovable chat-generated SQL, dashboard
edits, arbitrary schema repair, history rewriting, or future migrations by default.

The migration must retain byte SHA-256
`a9a7d6a980875602100a8994deccef406162535976d58804e0f054f34be665e6`
and statement SHA-256
`cea88a9c1cf006916cbf4dc5d8780b5133830af77fcebe993d2f8da2c496c752`.

For this migration only, explicit adoption would replace:

1. The linked CLI dry-run requirement in `DATABASE-MIGRATION-PROCESS.md` with
   the fresh exact remote-ledger comparison below. This proves the pending set;
   it is not an execution rehearsal or a claim that the CLI ran.
2. The ban on Lovable schema transport with the single reviewed transactional
   application below. Git remains authoritative.
3. Pre-application staging promotion in that document and
   `STAGING-AND-ROLLBACK.md` with the existing isolated PostgreSQL replay and
   acceptance/security checks, followed by controlled deployed verification.
   This accepts a narrower test environment for this pre-launch migration.
4. Full Supabase database lint/type regeneration for this application with the
   existing isolated security lint and deterministic additive row-type checks.

These are explicit tradeoffs, not equivalent substitutes. Real hosting, Supabase
Auth, scheduler delivery, browser cookies, and simultaneous database clients
aren't proven by the isolated harness. A separate staging environment and the
documented launch gates remain required before admitting genuine customers.
The normal workflow remains in force for all other migrations.

## Read-only evidence already obtained

The September 9 comparison found 37 remote versions against 38 locked versions:
only the named recovery migration is pending, with no extra remote versions.
Every existing name matches. Of the 37 rows:

- 35 stored SQL digests match a locked byte or statement digest.
- `20260807193000` is the previously documented empty legacy statement row.
- `20260904110000` contains exactly one additional leading newline. Removing
  that one character produces the exact Git file. Its observed stored digest is
  `23203519865ebb0a66461a01d2d1b75a4eab29e28c7b342903539823bed89ebe`.

Adoption would accept that specific whitespace-only history difference without
changing its row or weakening comparisons for other migrations. Don't normalize
arbitrary whitespace or silently accept any new mismatch.

`lead_intakes` and `commit_plan_version` exist. The proposed sessions, welcome
jobs, and completed-run archive tables are absent, as expected before application.
Email controls are `sending_enabled=true`, `genuine_plans_admitted=false`, and
`provider_submission_limit=10`. These are observations, not permission to change
them. No linked database writes or test emails have occurred for this checkpoint.

## Preconditions after adoption

1. Use a clean checkout of the fresh GitHub release SHA with an independent green
   post-merge Quality Gate. Confirm the migration bytes above and run
   `bun run migration:check`. Documentation-only adoption must not change the
   approved application source fingerprint or migration-lock contents.
2. Reconfirm the authenticated Lovable project, enabled database, mapped public
   Supabase reference, and controlled pre-launch posture. Stop on source drift.
3. Export all remote versions, names, counts, and stored digests again. Require
   exactly the same 37-row history, allowing only the two specific legacy cases
   above. Require the one exact pending migration. Preserve this before-state.
4. Inspect the current definitions of functions that the migration replaces,
   dependent tables, indexes, constraints, triggers, RLS and grants against the
   canonical pre-migration replay. Ledger agreement alone isn't schema proof.
   Stop on unexplained drift. Verify compatibility with the still-running app.
5. Record operational gates and controlled scope, including payment/marketing
   controls relevant to this change, without recording secrets or participant
   data. Confirm no public admission or real payments are enabled.
6. Confirm isolated replay, acceptance checks, deterministic types, and the full
   repository gate passed for the exact application tree. Review the migration
   for transaction-incompatible statements and external effects at application
   time. Function definitions alone do not execute their bodies.
7. Prepare a generated application envelope containing the byte-exact SQL,
   precondition assertions, postcondition assertions, and its exact history row.
   Verify this envelope against the isolated database before live use. Do not
   hand-copy or split the migration into separately committed tool calls.

## Single application and verification

The envelope must execute in one database transaction. Use a transaction-scoped
advisory migration lock, a lock on the migration ledger to prevent a competing
ledger writer, bounded lock/statement timeouts, and assertions that recheck the
expected history and operational before-state inside the transaction.

Execute the exact reviewed SQL, assert the expected new objects and security
properties, then insert the canonical version, name, and byte-exact statement as
one history entry. Assert its digest and unchanged operational controls before
commit. Do not use an upsert that could replace existing history.

Prove that the transport supports this transaction envelope before application
with a disposable temporary-table rollback probe. It must leave no persistent
objects, data, or external effects. If atomicity cannot be established, stop.

If the tool errors or times out, read the ledger and resulting schema first.
Never blindly retry. A fully matching row and verified objects indicate an
already committed application. A missing row plus unchanged schema permits
reassessment; partial or unexpected state requires investigation and a reviewed
forward repair. Never repair uncertainty by deleting data or rewriting history.

After commit, independently read all 38 history rows and compare their digests;
verify new tables, constraints, function definitions, RLS, service-role grants,
and denied public/anonymous/authenticated access. Compare additive row types and
operational gates to the approved expectations. Record non-secret evidence in
Git through a separate documentation PR.

The migration alone does not complete the launch blocker. Publication remains
separately approved and uses the existing release preflight and publisher.
Controlled email/browser tests still require approval before creating live test
data or sending mail. They must exercise the acceptance matrix in
`SIGNUP-RECOVERY-CHECKPOINT.md`. Public intake remains closed.

## Review decision

Approve adoption and merge of this proposal to use the procedure above for the
single named migration. That approval explicitly accepts the listed pre-launch
test limitations and transport substitution. It doesn't approve a general
relaxation of future release rules, deployment, public intake, new infrastructure,
secret changes, live mail, or history repair.
