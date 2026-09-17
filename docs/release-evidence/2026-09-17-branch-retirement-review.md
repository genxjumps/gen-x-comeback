# Branch and Pull-Request Retirement Review - September 17, 2026

**Role:** Evidence
**Compared release:** `release/v1.1` at `a7a2c05216ed5a4ef67d312021ddc643ef993f01`

This review classifies the work preserved by the September 17 repository inventory. It does not
delete a branch, create an archival ref, close a pull request, merge product code, change the
default branch, or reconcile `main`.

## Repository result after PR #268

The 260 remote branches divide into:

- 249 branches whose heads are reachable from the compared release;
- one exact release head, `release/v1.1`;
- 10 branches with commits not reachable from the compared release.

The full 260-branch name and SHA inventory remains in
[`2026-09-17-project-reset-inventory.md`](2026-09-17-project-reset-inventory.md). Every branch listed
there as **Fully reachable from release** is a retirement candidate, with these updates and
exceptions:

- `agent/project-reset-inventory` became reachable when PR #268 merged and is also a retirement
  candidate.
- `archive/pre-reset-2026-09-17` is reachable but must be retained as the exact pre-reset recovery
  point.
- `release/v1.1` is the active integration branch and must be retained.

This defines the exact reachable-branch retirement set without duplicating the 260-row immutable
inventory: all rows classified **Fully reachable from release**, plus
`agent/project-reset-inventory`, minus `archive/pre-reset-2026-09-17`.
It contains 248 branches.

No reachable branch may be deleted until Todd separately approves the retirement action and a fresh
read-only comparison confirms that it has not moved.

## Ten branches with unique commits

| Branch                                 | Finding                                                                                                                                                          | Required preservation before retirement                                                                                 | Decision                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `main`                                 | Three unique merge commits produce no unique file delta from their common base with release. Release is 826 commits ahead.                                       | Preserve through a normal non-destructive reconciliation.                                                               | Retain. Do not delete or rewrite.                     |
| `agent/pin-production-email-origin`    | The hard production email-origin guard is absent from current source. Current source resolves configured `APP_ORIGIN`.                                           | Keep exact branch and PR #35 until the behavior is decided and, if approved, rebuilt on current source.                 | Retain unresolved.                                    |
| `agent/signup-migration-evidence`      | Two legitimate September 9 migration/publication evidence files were missing from release. This cleanup restores their substance under `docs/release-evidence/`. | Keep exact branch until this cleanup merges, then create an archival ref at `9b35a932d9e0bc63582c5879bd339d1994eebdee`. | Retire only after evidence merge and archival ref.    |
| `agent/v1-1-cloudflare-media-a-e`      | A-E identifiers, runtimes, helper, rendering, and tests are present and extended in current release.                                                             | Create an archival ref at `fbb72309eaecef94eae076b5661cf6a479cab9b7`.                                                   | Superseded candidate.                                 |
| `agent/website-lead-handoff`           | The intended website handoff exists in newer form. This branch uses the old session-storage flow and would reopen intake.                                        | Create an archival ref at `a129dd15149a38c311d98da87ca59cf57197b49d`.                                                   | Superseded candidate. Never merge this stale PR.      |
| `agent/fix-return-cookie-transport`    | The recovery contract and portable-session behavior were implemented through later accepted commits; the current contract is more complete.                      | Create an archival ref at `bfc3cbd1926ebaa97b30ace57b391843aa3ae79f`.                                                   | Superseded candidate.                                 |
| `agent/document-purchase-architecture` | Its purchase-path decisions already appear in the current Accelerator contract, implementation record, and checkout documentation.                               | Create an archival ref at `48aeeeb1e3de2c8a9ba4ef1914fa0ed377d0126d`.                                                   | Superseded candidate.                                 |
| `agent/fix-return-cookie-read`         | Current source uses the same TanStack request-header read plus later diagnostics.                                                                                | Create an archival ref at `aa999cb4c9e662fc94cf6c7e832ce2836b30407f`.                                                   | Superseded candidate.                                 |
| `agent/fix-return-session-cookie`      | Current source uses the later framework-native cookie write plus the raw response header.                                                                        | Create an archival ref at `8278833e089c1f66f5b78f3487a8963a4ff9873c`.                                                   | Superseded candidate.                                 |
| `agent/v1.1-functional-map`            | The proposed August build map is historical and conflicts with implemented account, design, checkout, and program behavior.                                      | Create an archival ref at `5f4c83103e9835a885c6bf1c28171a73abe0dbe4`.                                                   | Historical candidate. Do not merge into current docs. |

“Archival ref” means a separately approved immutable tag or archive branch that resolves to the
exact recorded SHA. Creating one does not itself authorize deletion.

## Five preserved pull requests

|  PR | Decision after content review                                                                                          |
| --: | ---------------------------------------------------------------------------------------------------------------------- |
| #35 | Keep open. It contains the unresolved production email-origin decision.                                                |
| #90 | Keep open until the restored evidence merges and its exact head has an archival ref.                                   |
| #81 | Do not merge. Eligible to close only after its exact head has an archival ref.                                         |
| #72 | Content is present in current contracts. Eligible to close only after its exact head has an archival ref.              |
| #26 | Media work is present and extended in current source. Eligible to close only after its exact head has an archival ref. |

## Separate actions still requiring approval

1. Create the exact archival refs listed above.
2. Re-run the branch comparison and stop if any candidate head moved.
3. Delete only the separately approved candidate branches.
4. Close only the separately approved superseded pull requests with a link to their replacement or
   evidence record.
5. Reconcile `main` and decide the long-term default branch without force-push, rebase, squash, or
   history rewrite.
