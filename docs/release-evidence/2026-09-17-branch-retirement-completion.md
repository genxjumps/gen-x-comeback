# Branch Retirement Completion - September 17, 2026

**Role:** Evidence  
**Compared release:** `release/v1.1` at `1200421deec2ca3b7bedac2811fa0e9fe03d6b7d`  
**Successful cleanup run:** [GitHub Actions #35213638821](https://github.com/genxjumps/gen-x-comeback/actions/runs/35213638821)

This record closes the preservation-first branch and pull-request cleanup reviewed in
[`2026-09-17-branch-retirement-review.md`](2026-09-17-branch-retirement-review.md).

## Result

- Todd separately approved the archival-ref creation, stale-PR closure, and exact branch deletion.
- Eight unique candidate heads were copied to dated archive branches and verified at their audited
  SHAs before their original working branches were deleted.
- PRs #26, #72, #81, and #90 were closed without merging after preservation comments were added.
- PR #35 and `agent/pin-production-email-origin` remain open and untouched.
- A fresh pre-delete comparison validated exactly 257 deletion targets and 12 retained branches.
- The successful cleanup retired all 257 approved targets and verified the final 12-branch set.
- The repository moved from 269 branches to 12 branches.

## Retained refs

| Branch                                                            | Verified SHA                               | Reason                          |
| ----------------------------------------------------------------- | ------------------------------------------ | ------------------------------- |
| `release/v1.1`                                                    | `1200421deec2ca3b7bedac2811fa0e9fe03d6b7d` | Active integration source       |
| `main`                                                            | `42c548a966c0e57fc25cff53a22849783169dc60` | Retained pending reconciliation |
| `archive/pre-reset-2026-09-17`                                    | `9edba783553d87dc0cc76e4aca5774e4e9b63b61` | Exact pre-reset recovery point  |
| `agent/pin-production-email-origin`                               | `739fa65abbeb4c8af0585b2c8f4ff22d6140ccfb` | Unresolved PR #35 decision      |
| `archive/retired-2026-09-17/agent/signup-migration-evidence`      | `9b35a932d9e0bc63582c5879bd339d1994eebdee` | Preserved unique head           |
| `archive/retired-2026-09-17/agent/v1-1-cloudflare-media-a-e`      | `fbb72309eaecef94eae076b5661cf6a479cab9b7` | Preserved unique head           |
| `archive/retired-2026-09-17/agent/website-lead-handoff`           | `a129dd15149a38c311d98da87ca59cf57197b49d` | Preserved unique head           |
| `archive/retired-2026-09-17/agent/fix-return-cookie-transport`    | `bfc3cbd1926ebaa97b30ace57b391843aa3ae79f` | Preserved unique head           |
| `archive/retired-2026-09-17/agent/document-purchase-architecture` | `48aeeeb1e3de2c8a9ba4ef1914fa0ed377d0126d` | Preserved unique head           |
| `archive/retired-2026-09-17/agent/fix-return-cookie-read`         | `aa999cb4c9e662fc94cf6c7e832ce2836b30407f` | Preserved unique head           |
| `archive/retired-2026-09-17/agent/fix-return-session-cookie`      | `8278833e089c1f66f5b78f3487a8963a4ff9873c` | Preserved unique head           |
| `archive/retired-2026-09-17/agent/v1.1-functional-map`            | `5f4c83103e9835a885c6bf1c28171a73abe0dbe4` | Preserved unique head           |

## Pull-request result

| PR  | Final state | Reason                                                           |
| --- | ----------- | ---------------------------------------------------------------- |
| #26 | Closed      | Media work is present and extended in current source             |
| #72 | Closed      | Purchase decisions are represented in current contracts          |
| #81 | Closed      | Stale handoff would reopen intake and must not be merged         |
| #90 | Closed      | Evidence was restored through PR #269 before branch retirement   |
| #35 | Open        | Production email-origin behavior still requires a fresh decision |

## Execution evidence

The first generated workflow file produced
[run #35213557597](https://github.com/genxjumps/gen-x-comeback/actions/runs/35213557597),
but invalid indentation prevented GitHub from creating a job. It deleted nothing.

The corrected one-time workflow produced
[run #35213638821](https://github.com/genxjumps/gen-x-comeback/actions/runs/35213638821).
It validated the expected branch count, every retained SHA, and every target SHA before deletion. It
deleted 256 targets, verified the 13 remaining refs, deleted its own executor branch, then verified
the exact 12-branch final set.

An independent post-run comparison confirmed the same 12 branch names and SHAs and confirmed PR #35
remained open at `739fa65abbeb4c8af0585b2c8f4ff22d6140ccfb`.

## Scope exclusions

This cleanup did not change `release/v1.1`, `main`, application files, database state, migrations,
deployment, production, provider configuration, email controls, payment controls, public intake, or
customer data. It did not require browser, checkout, migration, or customer-flow retesting because
the tested application source did not change.
