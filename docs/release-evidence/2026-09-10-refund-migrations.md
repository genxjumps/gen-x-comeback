# Refund migrations applied and independently verified

Todd explicitly adopted the scoped Cloud procedure with PR #94, approved the
combined rehearsal package, and separately approved applying the migration pair.
Deployment remained outside that approval.

## Execution identity

- Release: `0ccfda3e7dff5773f9693ef2f7fd95e4a1daeee7`.
- Independent post-merge Quality Gate: [run 34468435957](https://github.com/genxjumps/gen-x-comeback/actions/runs/34468435957), successful on that exact SHA.
- Lovable source matched the same release immediately before application.
- Lovable project: `9882f922-c17b-4fca-bd5b-48b9548e5322`.
- Supabase reference: `wrvjgjvdjjoytjdwntlx`.
- Submitted: `2026-09-10T11:08:07.523Z`.
- Independently verified: `2026-09-10T11:08:40.141Z`.
- Combined SQL: 61,027 bytes, SHA-256
  `dcf151de592974393d692285c5a90e90e62badb9ad847390a8c36c6108813c63`.

## What executed

Fresh read-only checks matched the exact approved 38-row ledger, pre-migration
schema fingerprint, hosted default grants, and operational control fingerprint.
Migration integrity passed from a clean release checkout. A disposable temporary
table probe confirmed transactional rollback through the authenticated transport
and left no persistent table or data.

The approved envelope executed once through authenticated `query_database`, in
one transaction with a migration advisory lock, ledger lock, bounded timeouts,
UTC timestamp handling, and pre/postcondition assertions. It applied these exact
Git files in order and inserted two separate canonical history entries:

| Version          | Name                             | Byte SHA-256                                                       |
| ---------------- | -------------------------------- | ------------------------------------------------------------------ |
| `20260910100000` | `accelerator_refund_requests`    | `604ce6c148d5e605f9b74621c2c540b3cdda4deb82c68f8cbdbfcd474dabfa8d` |
| `20260910110000` | `accelerator_refund_permissions` | `f44c4a4e09c6ae1919fc9260d677626b3d46d84bbe84dc2224963d0120750e23` |

No retry, history repair, down migration, participant test fixture, provider call,
refund, or reviewer assignment was performed. The two adopted legacy history
exceptions remain unchanged: `20260807193000` has an empty statement array and
`20260904110000` has the exact documented additional leading newline.

## Independent verification

After application, separate reads established:

- All 40 ledger versions, names, counts, and SQL digests exactly match the
  expected result, including both new byte-exact statements and unchanged old rows.
- The resulting schema fingerprint matches the canonical isolated replay,
  including the new tables, indexes, constraints, RLS, and all expected function
  bodies. It is
  `669eb39064a2dbfdbe52693da5dc3aa04bbc7a39a8cecac5d13f38da43736023`.
- `supabase/accelerator-refunds.permissions.sql` passed against the hosted
  database. Runtime access is SELECT/INSERT/UPDATE on the three new tables and
  EXECUTE on the four refund functions, without grant option. DELETE/TRUNCATE
  are denied to the service role; anonymous, authenticated, and sandbox roles
  have no effective access. Owners retain database administration.
- The four RPC argument lists and PostgreSQL types match the committed generated
  refund types. No browser database grants were added.
- The refund request, refund receipt, and reviewer tables are all empty.
- Global default privileges and both the scoped and full email-control
  fingerprints match their before-state exactly.

Machine-readable [before/after evidence](2026-09-10-refund-migrations.json) includes
the complete ledger comparison, fingerprints, permission result, and RPC types.
It contains no provider secrets, participant emails, or secure access links.

## Current boundary

The database foundation is applied; refund handling hasn't been deployed or
verified with a controlled Stripe event. Email controls remain sending enabled,
genuine plan admission disabled, provider limit 10, paid-access sending enabled,
and paid-access customer admission enabled. The latter is an existing setting,
not a change made during this operation. Recorded Stripe purchases were test-mode
references; no provider configuration was changed.

Reviewer provisioning, Edge/application deployment, webhook subscriptions,
controlled Stripe refund testing, and public launch retain separate approvals.
Full refund acceptance requires those applicable steps; schema success alone
doesn't prove browser behavior, actual Stripe signatures, or settlement.
