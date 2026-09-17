# Repository Inventory - September 17, 2026

**Role:** Evidence  
**Scope:** Preservation-first Phase 1 inventory  
**Source baseline:** `release/v1.1` at `9edba783553d87dc0cc76e4aca5774e4e9b63b61`

No branch, pull request, file, migration, deployment, or customer data was deleted or changed while
creating this inventory.

## Recovery points

- `archive/pre-reset-2026-09-17` preserves the exact release source before documentation cleanup.
- `release/v1.1` remains the active integration source.
- Git history remains unchanged.
- `main` remains untouched and protected.
- Production remains untouched.

## Repository summary

| Item                                                          | Count or value                             |
| ------------------------------------------------------------- | ------------------------------------------ |
| Tracked files at audited release                              | 459                                        |
| Markdown files                                                | 37                                         |
| Files under `docs/`                                           | 36                                         |
| Test files                                                    | 99                                         |
| Database migration files                                      | 41                                         |
| Branches after creating the two reset branches                | 260                                        |
| Branches fully reachable from `release/v1.1`                  | 247                                        |
| Branches exactly matching `release/v1.1`                      | 3                                          |
| Branches containing commits not reachable from `release/v1.1` | 10                                         |
| Open pull requests                                            | 5                                          |
| Current release Quality Gate                                  | Passed                                     |
| Published app SHA during audit                                | `e5fd50e5d767bdacdc3a843948748f6ca8d546ac` |

## Branches containing unique commits

These branches are preserved. “Unique” means at least one commit is not reachable from the audited
release head. It does not mean the change should be merged, nor that equivalent behavior is absent
from newer source.

| Branch                                 | Head SHA                                   | Unique commits | Initial classification                                            |
| -------------------------------------- | ------------------------------------------ | -------------: | ----------------------------------------------------------------- |
| `agent/v1-1-cloudflare-media-a-e`      | `fbb72309eaecef94eae076b5661cf6a479cab9b7` |              7 | 7 unique commits - Accelerator media integration work             |
| `agent/website-lead-handoff`           | `a129dd15149a38c311d98da87ca59cf57197b49d` |              5 | 5 unique commits - earlier website intake handoff                 |
| `main`                                 | `42c548a966c0e57fc25cff53a22849783169dc60` |              3 | 3 unique commits - protected default branch divergence            |
| `agent/fix-return-cookie-transport`    | `bfc3cbd1926ebaa97b30ace57b391843aa3ae79f` |              2 | 2 unique commits - recovery portability evidence/tests            |
| `agent/pin-production-email-origin`    | `739fa65abbeb4c8af0585b2c8f4ff22d6140ccfb` |              2 | 2 unique commits - production email-origin work                   |
| `agent/signup-migration-evidence`      | `9b35a932d9e0bc63582c5879bd339d1994eebdee` |              2 | 2 unique commits - signup recovery migration/publication evidence |
| `agent/document-purchase-architecture` | `48aeeeb1e3de2c8a9ba4ef1914fa0ed377d0126d` |              1 | 1 unique commit - purchase architecture documentation             |
| `agent/fix-return-cookie-read`         | `aa999cb4c9e662fc94cf6c7e832ce2836b30407f` |              1 | 1 unique commit - recovery cookie read experiment                 |
| `agent/fix-return-session-cookie`      | `8278833e089c1f66f5b78f3487a8963a4ff9873c` |              1 | 1 unique commit - recovery cookie transport experiment            |
| `agent/v1.1-functional-map`            | `5f4c83103e9835a885c6bf1c28171a73abe0dbe4` |              1 | 1 unique commit - historical functional-build map                 |

No unique branch is approved for deletion. Each requires a content-level comparison before any
later cleanup decision.

## Open pull requests preserved

|  PR | Title                                                          | Head branch                            | Condition at audit                                              |
| --: | -------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| #90 | Record completed signup recovery database migration            | `agent/signup-migration-evidence`      | Draft, behind current release, contains unique evidence commits |
| #81 | Connect website signup to app intake                           | `agent/website-lead-handoff`           | Open, badly behind current release, contains unique commits     |
| #72 | Document Accelerator purchase architecture                     | `agent/document-purchase-architecture` | Draft, badly behind current release, contains one unique commit |
| #35 | V1.1: pin production email origin                              | `agent/pin-production-email-origin`    | Draft, badly behind current release, contains unique commits    |
| #26 | Connect Workouts A-E to the existing Cloudflare player pattern | `agent/v1-1-cloudflare-media-a-e`      | Open, badly behind current release, contains unique commits     |

No open PR was closed or modified in Phase 1.

## Documentation risks recorded

- The root README was last materially current before most V1.1 implementation.
- `.lovable/plan.md` contains a completed September 2 recovery investigation but looked active.
- `APP_MAP_AND_DESIGN_SYSTEM.md` mixes recommendations, approved rules, historical rationale, and
  route-specific exceptions.
- Several checkpoint documents contain old PR, merge, migration, or release status.
- Review scenarios, product states, access states, view conditions, and release states were often
  described using the same generic word.
- The GitHub default branch is not the active integration source, so default-branch search can
  return stale code and documentation.

## Review-system risks recorded

- The review registry contains 65 scenarios.
- `src/components/app-review-screen.tsx` is approximately 2,390 lines and manually reconstructs
  substantial portions of customer-facing screens.
- `src/lib/app-review.ts` is approximately 701 lines.
- Review coverage is valuable, but manually duplicated screen structure can drift from live routes.

No review code was changed in Phase 1.

## Workflow cost recorded

The release-source manifest is approximately 1,658 lines and hashes tracked build inputs. Small
source changes therefore require a manifest update before the full quality gate. The recent free-plan
landing iteration produced nine merged PRs and 39 commits after the currently published revision,
while affecting eight files.

This inventory does not weaken release controls. It records the need for a lighter iteration loop
before the final release gate.

## Complete branch snapshot

Classification is relative to `release/v1.1` at `9edba783553d87dc0cc76e4aca5774e4e9b63b61`.

| Branch                                           | Head           | Classification               | Unique commits |
| ------------------------------------------------ | -------------- | ---------------------------- | -------------: |
| `accelerator-active-recovery-written-guide`      | `5dd7fca476e9` | Fully reachable from release |              0 |
| `agent/28-day-enrollment-progress`               | `57f79b96ca98` | Fully reachable from release |              0 |
| `agent/28-day-foundation`                        | `ae78a8df2da7` | Fully reachable from release |              0 |
| `agent/28-day-program-shell`                     | `618006441ba3` | Fully reachable from release |              0 |
| `agent/7-day-onboarding-install`                 | `853d73a15fa3` | Fully reachable from release |              0 |
| `agent/accelerator-active-review`                | `68f122d8dfb4` | Fully reachable from release |              0 |
| `agent/accelerator-card-exact`                   | `7358e1a7c547` | Fully reachable from release |              0 |
| `agent/accelerator-card-match`                   | `ec7ee6163cb9` | Fully reachable from release |              0 |
| `agent/accelerator-cta-copy`                     | `ade7fec6c8d1` | Fully reachable from release |              0 |
| `agent/accelerator-real-cover`                   | `2a9f85047e04` | Fully reachable from release |              0 |
| `agent/accelerator-refund-requests`              | `01cecc5ce7a0` | Fully reachable from release |              0 |
| `agent/accelerator-remove-price`                 | `d830cbe6229a` | Fully reachable from release |              0 |
| `agent/accelerator-sales-page`                   | `e225d3789623` | Fully reachable from release |              0 |
| `agent/accelerator-setup-design`                 | `65658f61fa5c` | Fully reachable from release |              0 |
| `agent/accelerator-stat-boxes`                   | `2801a3cfe230` | Fully reachable from release |              0 |
| `agent/accelerator-stat-content`                 | `0fb482e1b39f` | Fully reachable from release |              0 |
| `agent/accelerator-stat-row`                     | `d46dcbff25ed` | Fully reachable from release |              0 |
| `agent/accept-stripe-opaque-client-secret`       | `79b1f50eb775` | Fully reachable from release |              0 |
| `agent/account-identity-logout`                  | `4c2fe4b08038` | Fully reachable from release |              0 |
| `agent/account-inline-purchases`                 | `cad7902576d2` | Fully reachable from release |              0 |
| `agent/account-navigation`                       | `eacf299e3a17` | Fully reachable from release |              0 |
| `agent/account-purchase-presentation`            | `3780bddd20fc` | Fully reachable from release |              0 |
| `agent/account-purchases-billing`                | `514e49a3c591` | Fully reachable from release |              0 |
| `agent/account-recovery-cloud-procedure`         | `21a6b5413d8a` | Fully reachable from release |              0 |
| `agent/account-remove-redundant-navigation`      | `115b3e81c1aa` | Fully reachable from release |              0 |
| `agent/add-workout-overview-grid`                | `3dbf3f55e315` | Fully reachable from release |              0 |
| `agent/align-active-nutrition-header`            | `3b0da429738e` | Fully reachable from release |              0 |
| `agent/align-fitness-hub-heading`                | `59e2ac38decc` | Fully reachable from release |              0 |
| `agent/align-review-button-type`                 | `1a7f0d2d41fb` | Fully reachable from release |              0 |
| `agent/align-section-spacing`                    | `78dd823ae378` | Fully reachable from release |              0 |
| `agent/align-workout-page-title`                 | `14ab272a4b97` | Fully reachable from release |              0 |
| `agent/app-copy-doc-edits`                       | `36f838be9e55` | Fully reachable from release |              0 |
| `agent/app-information-architecture`             | `c5175ebc2933` | Fully reachable from release |              0 |
| `agent/app-review-hub`                           | `db809008a6c9` | Fully reachable from release |              0 |
| `agent/app-style-assessment-inputs`              | `bf426bd81d11` | Fully reachable from release |              0 |
| `agent/apply-accelerator-workout-design`         | `77cdd8b0ef10` | Fully reachable from release |              0 |
| `agent/apply-seven-day-intake-design`            | `c66c1b20fa54` | Fully reachable from release |              0 |
| `agent/apply-seven-day-schedule-system`          | `e5d63ed1da7f` | Fully reachable from release |              0 |
| `agent/assessment-cover-palette`                 | `579d3cdf9ff1` | Fully reachable from release |              0 |
| `agent/assessment-page-composition`              | `17556c5ec42a` | Fully reachable from release |              0 |
| `agent/assessment-poster-hero`                   | `1d7bce9195a4` | Fully reachable from release |              0 |
| `agent/assessment-step-3-design`                 | `6bdf23756540` | Fully reachable from release |              0 |
| `agent/barlow-interface-type`                    | `1ee57c7da8b9` | Fully reachable from release |              0 |
| `agent/checkout-confirmed-copy`                  | `7edf83c1fee5` | Fully reachable from release |              0 |
| `agent/checkout-processing-copy`                 | `ff408050f9ad` | Fully reachable from release |              0 |
| `agent/clarify-cardio-guidance`                  | `f853eef96bd7` | Fully reachable from release |              0 |
| `agent/clarify-day-one-cardio-options`           | `696d02c6c5fd` | Fully reachable from release |              0 |
| `agent/clarify-program-duration-markers`         | `4591e7ee8ebb` | Fully reachable from release |              0 |
| `agent/clarify-short-burst-guidance`             | `618bcf849142` | Fully reachable from release |              0 |
| `agent/clean-home-panel-hierarchy`               | `1162c0d28e20` | Fully reachable from release |              0 |
| `agent/cloud-migration-procedure`                | `69598bb3bd0a` | Fully reachable from release |              0 |
| `agent/compact-home-workout-panel`               | `4b6874e4e84b` | Fully reachable from release |              0 |
| `agent/connect-home-secondary-links`             | `57bb40460361` | Fully reachable from release |              0 |
| `agent/continue-home-workout-design`             | `bd9559c6cb94` | Fully reachable from release |              0 |
| `agent/controlled-deployment-proof`              | `d56575f1afa0` | Fully reachable from release |              0 |
| `agent/controlled-preview-gmail-aliases`         | `4e01b3fe1c4c` | Fully reachable from release |              0 |
| `agent/copy-review-welcome`                      | `172c79745a0f` | Fully reachable from release |              0 |
| `agent/copy-review-welcome-congrats`             | `9d7da24f6961` | Fully reachable from release |              0 |
| `agent/correct-workout-runtimes`                 | `1d60fcb1e51a` | Fully reachable from release |              0 |
| `agent/darken-plan-ready-cta`                    | `c08838c94502` | Fully reachable from release |              0 |
| `agent/day-2-easy-movement-copy`                 | `df5421debbda` | Fully reachable from release |              0 |
| `agent/day-4-recovery-copy`                      | `a24226dd6671` | Fully reachable from release |              0 |
| `agent/day-7-rest-copy`                          | `3a7e454cd715` | Fully reachable from release |              0 |
| `agent/day-one-title-copy`                       | `56e29c21a88c` | Fully reachable from release |              0 |
| `agent/day-workout-covers`                       | `cd4056a18090` | Fully reachable from release |              0 |
| `agent/design-eligibility-review`                | `a2d9e7ff3cc0` | Fully reachable from release |              0 |
| `agent/design-plan-ready`                        | `dfa2e1096fa4` | Fully reachable from release |              0 |
| `agent/design-seven-day-plan`                    | `cb1d71116a61` | Fully reachable from release |              0 |
| `agent/design-welcome-email-states`              | `f52d108c1386` | Fully reachable from release |              0 |
| `agent/distress-accelerator-card`                | `bcc6bcc46640` | Fully reachable from release |              0 |
| `agent/document-purchase-architecture`           | `48aeeeb1e3de` | Contains unique commits      |              1 |
| `agent/embedded-website-checkout`                | `7dbda93995cc` | Fully reachable from release |              0 |
| `agent/enlarge-workout-cover-title`              | `a8137f1bc542` | Fully reachable from release |              0 |
| `agent/environment-cleanup`                      | `09146c810ebc` | Fully reachable from release |              0 |
| `agent/fix-accelerator-provision-lock`           | `24790d7f5c6d` | Fully reachable from release |              0 |
| `agent/fix-accelerator-setup-route`              | `a1ef8cdb7c71` | Fully reachable from release |              0 |
| `agent/fix-accelerator-workout-review-route`     | `982ba2d993c6` | Fully reachable from release |              0 |
| `agent/fix-day-one-rpc-receiver`                 | `484b3cee5010` | Fully reachable from release |              0 |
| `agent/fix-home-workout-equipment-copy`          | `7f81dcf89d56` | Fully reachable from release |              0 |
| `agent/fix-member-token-verification`            | `a7c8aafc1d25` | Fully reachable from release |              0 |
| `agent/fix-programs-title-scale`                 | `153242f3e47d` | Fully reachable from release |              0 |
| `agent/fix-return-cookie-read`                   | `aa999cb4c9e6` | Contains unique commits      |              1 |
| `agent/fix-return-cookie-transport`              | `bfc3cbd1926e` | Contains unique commits      |              2 |
| `agent/fix-return-session-cookie`                | `8278833e089c` | Contains unique commits      |              1 |
| `agent/focus-plan-ready-action`                  | `3eab336354a8` | Fully reachable from release |              0 |
| `agent/free-plan-campaign-page`                  | `0c98271f38e2` | Fully reachable from release |              0 |
| `agent/free-plan-conversion-page`                | `b9ac0fc3a070` | Fully reachable from release |              0 |
| `agent/free-plan-eyebrow`                        | `146a2ee4a3ba` | Fully reachable from release |              0 |
| `agent/free-plan-hero-cleanup`                   | `38edda0bb572` | Fully reachable from release |              0 |
| `agent/free-plan-landing-design`                 | `886c77e3c28c` | Fully reachable from release |              0 |
| `agent/full-active-nutrition-review`             | `0aad802b674f` | Fully reachable from release |              0 |
| `agent/github-first-workflow`                    | `2a84e2031ef4` | Fully reachable from release |              0 |
| `agent/home-assessment-design-system`            | `f4bf1af81f23` | Fully reachable from release |              0 |
| `agent/home-heading-hierarchy`                   | `d91110ade240` | Fully reachable from release |              0 |
| `agent/home-no-box`                              | `3a1344f73676` | Fully reachable from release |              0 |
| `agent/home-shell-design`                        | `ced9a3473592` | Fully reachable from release |              0 |
| `agent/home-snapshots`                           | `aca212866e8b` | Fully reachable from release |              0 |
| `agent/home-workout-launch-panel`                | `ff8969beec3d` | Fully reachable from release |              0 |
| `agent/immediate-plan-ready`                     | `38a98918718f` | Fully reachable from release |              0 |
| `agent/immediate-recovery-dispatch`              | `4bc8d01adc08` | Fully reachable from release |              0 |
| `agent/intake-closed-design`                     | `fcddfa7fce62` | Fully reachable from release |              0 |
| `agent/isolate-email-queue-failures`             | `5693a7723912` | Fully reachable from release |              0 |
| `agent/lighten-home-workout-launch`              | `1438f1fb39b9` | Fully reachable from release |              0 |
| `agent/lock-accelerator-launch-card`             | `f2e6472db0b0` | Fully reachable from release |              0 |
| `agent/lock-eligibility-design`                  | `330fd55d7a72` | Fully reachable from release |              0 |
| `agent/lock-energized-intake`                    | `a9ff341ac748` | Fully reachable from release |              0 |
| `agent/lock-my-programs-design`                  | `ac48b32440d2` | Fully reachable from release |              0 |
| `agent/lock-nutrition-design`                    | `f65a1811b762` | Fully reachable from release |              0 |
| `agent/lock-plan-ready-design`                   | `dc50e7bf2d0e` | Fully reachable from release |              0 |
| `agent/lock-progress-design`                     | `f4e96f5dc3eb` | Fully reachable from release |              0 |
| `agent/lock-simple-status-pages`                 | `232f4508debd` | Fully reachable from release |              0 |
| `agent/lock-welcome-design`                      | `6fb9432594e3` | Fully reachable from release |              0 |
| `agent/lock-welcome-email-states`                | `5c1aa86b9c6c` | Fully reachable from release |              0 |
| `agent/lovable-controlled-preview-forward-sync`  | `4d19a3e365c0` | Fully reachable from release |              0 |
| `agent/mailerlite-edge-runtime`                  | `fed02996aeb3` | Fully reachable from release |              0 |
| `agent/mailerlite-lead-sync`                     | `d5d1aba000d6` | Fully reachable from release |              0 |
| `agent/mailerlite-live-gate-refresh`             | `d3db5155c7b8` | Fully reachable from release |              0 |
| `agent/match-account-icon-circle`                | `cbb10b52fbbc` | Fully reachable from release |              0 |
| `agent/match-progress-meter`                     | `74887b0d0e20` | Fully reachable from release |              0 |
| `agent/match-progress-percentage-scale`          | `06751570e6b3` | Fully reachable from release |              0 |
| `agent/match-workout-card-type`                  | `504151d2c3ee` | Fully reachable from release |              0 |
| `agent/member-labels`                            | `05798b754314` | Fully reachable from release |              0 |
| `agent/migration-integrity`                      | `63d168a473a2` | Fully reachable from release |              0 |
| `agent/move-day-one-prep-above-video`            | `712517718170` | Fully reachable from release |              0 |
| `agent/numbered-plan-states`                     | `4138337d524f` | Fully reachable from release |              0 |
| `agent/nutrition-body-type`                      | `8bc235a7aecb` | Fully reachable from release |              0 |
| `agent/nutrition-entry-design`                   | `05cb08d91b23` | Fully reachable from release |              0 |
| `agent/nutrition-entry-review`                   | `3623ab102a41` | Fully reachable from release |              0 |
| `agent/nutrition-entry-title`                    | `a1f710b61b2f` | Fully reachable from release |              0 |
| `agent/nutrition-locked-center`                  | `f073f72eff40` | Fully reachable from release |              0 |
| `agent/nutrition-meal-stat-treatment`            | `8a8d1fdb527c` | Fully reachable from release |              0 |
| `agent/nutrition-percent-sliders`                | `bba6a66cac9e` | Fully reachable from release |              0 |
| `agent/nutrition-percentage-alignment`           | `4d1006ebc00b` | Fully reachable from release |              0 |
| `agent/nutrition-safari-slider`                  | `a246fe9e85d6` | Fully reachable from release |              0 |
| `agent/nutrition-setup-design`                   | `d49e61446c35` | Fully reachable from release |              0 |
| `agent/nutrition-target-grid`                    | `b6cd0d395c96` | Fully reachable from release |              0 |
| `agent/nutrition-target-heading`                 | `60b918502452` | Fully reachable from release |              0 |
| `agent/nutrition-target-review-type`             | `619fca08cbb5` | Fully reachable from release |              0 |
| `agent/nutrition-timestamp-reload`               | `adc53afd2d18` | Fully reachable from release |              0 |
| `agent/nutrition-typography`                     | `7947e509ad68` | Fully reachable from release |              0 |
| `agent/nutrition-unavailable-copy`               | `0aa6fad2f795` | Fully reachable from release |              0 |
| `agent/nutrition-workout-copy-match`             | `6bd7a674c59d` | Fully reachable from release |              0 |
| `agent/open-home-composition`                    | `7e329a66b8fa` | Fully reachable from release |              0 |
| `agent/open-nutrition-layout`                    | `48847a3c5a98` | Fully reachable from release |              0 |
| `agent/open-plan-preview`                        | `1232cab1d8f3` | Fully reachable from release |              0 |
| `agent/paid-access-recovery`                     | `0beb59a234f9` | Fully reachable from release |              0 |
| `agent/pin-production-email-origin`              | `739fa65abbeb` | Contains unique commits      |              2 |
| `agent/plain-assessment-step-one-copy`           | `6e549cd9e4cf` | Fully reachable from release |              0 |
| `agent/plain-assessment-step-three-copy`         | `064a9ab2ad27` | Fully reachable from release |              0 |
| `agent/plain-assessment-step-two-copy`           | `d9ac19a32dc8` | Fully reachable from release |              0 |
| `agent/plain-before-you-start-copy`              | `ffaedaf107ad` | Fully reachable from release |              0 |
| `agent/plan-nav-copy`                            | `f3c614d38df3` | Fully reachable from release |              0 |
| `agent/post-purchase-navigation`                 | `bfcf414107ca` | Fully reachable from release |              0 |
| `agent/prelaunch-intake-gate`                    | `6332a017d242` | Fully reachable from release |              0 |
| `agent/preview-checkout-retry-cap`               | `ceb18d53cad8` | Fully reachable from release |              0 |
| `agent/project-reset-inventory`                  | `9edba783553d` | Exact release match          |              0 |
| `agent/public-entry-closed-state`                | `770d2ba1e78b` | Fully reachable from release |              0 |
| `agent/public-guest-checkout`                    | `7e3055b383ca` | Fully reachable from release |              0 |
| `agent/readme-cleanup`                           | `b1c918df60b2` | Fully reachable from release |              0 |
| `agent/rebalance-home-day-art`                   | `1bbe964adbb2` | Fully reachable from release |              0 |
| `agent/rebalance-plan-states`                    | `96cc465da403` | Fully reachable from release |              0 |
| `agent/reckless-accelerator-card`                | `81e61c4cbe94` | Fully reachable from release |              0 |
| `agent/reconcile-checkout-activation`            | `4539928dd5fe` | Fully reachable from release |              0 |
| `agent/recovery-auth-final`                      | `b490573066bf` | Fully reachable from release |              0 |
| `agent/recovery-cookie-boundary-instrumentation` | `b9380069caf3` | Fully reachable from release |              0 |
| `agent/recovery-csrf-public-origin`              | `b1b386409da8` | Fully reachable from release |              0 |
| `agent/recovery-format-only`                     | `622a81825d78` | Fully reachable from release |              0 |
| `agent/recovery-planhub-entry-probe`             | `41c9106ba4bb` | Fully reachable from release |              0 |
| `agent/recovery-portability-contract`            | `680522211a34` | Fully reachable from release |              0 |
| `agent/recovery-safe-client-auth`                | `432cbe0432d2` | Fully reachable from release |              0 |
| `agent/recovery-transactional-email-contract`    | `1b075bff5fcf` | Fully reachable from release |              0 |
| `agent/refine-assessment-focus`                  | `9f3944953973` | Fully reachable from release |              0 |
| `agent/refine-home-workout-launch`               | `a810e20458d8` | Fully reachable from release |              0 |
| `agent/refine-programs-without-cards`            | `439806aca100` | Fully reachable from release |              0 |
| `agent/refine-welcome-email-icon`                | `049adea63fe2` | Fully reachable from release |              0 |
| `agent/refine-workout-overview-type`             | `12013227dfb5` | Fully reachable from release |              0 |
| `agent/refine-workout-spacing`                   | `c1484a794fa0` | Fully reachable from release |              0 |
| `agent/refund-activation-evidence`               | `ab32319bead8` | Fully reachable from release |              0 |
| `agent/refund-cloud-permissions`                 | `f09475bff528` | Fully reachable from release |              0 |
| `agent/refund-migration-evidence`                | `ce5c52af6c84` | Fully reachable from release |              0 |
| `agent/refunded-account-recovery`                | `a49e674c0428` | Fully reachable from release |              0 |
| `agent/release-builder-diagnostics`              | `796b64e88469` | Fully reachable from release |              0 |
| `agent/release-hardening`                        | `cf7122fb9886` | Fully reachable from release |              0 |
| `agent/release-identity`                         | `ea2364831645` | Fully reachable from release |              0 |
| `agent/release-source-fingerprint`               | `972584a9995c` | Fully reachable from release |              0 |
| `agent/remove-assessment-stripe`                 | `8040a3ef1c55` | Fully reachable from release |              0 |
| `agent/remove-home-workout-summary`              | `9622a3a75db5` | Fully reachable from release |              0 |
| `agent/remove-repeated-day-labels`               | `c030524bc783` | Fully reachable from release |              0 |
| `agent/remove-repeated-program-durations`        | `f0d3e59d3a23` | Fully reachable from release |              0 |
| `agent/remove-saved-access-copy`                 | `db54762799f6` | Fully reachable from release |              0 |
| `agent/rename-fitness-hub`                       | `e8b2f6b297e7` | Fully reachable from release |              0 |
| `agent/repair-7-day-calendar-access`             | `ec8bb84af879` | Fully reachable from release |              0 |
| `agent/reposition-plan-maintenance-actions`      | `eb08b0f963fb` | Fully reachable from release |              0 |
| `agent/restore-full-app-entry`                   | `2e8b231a967e` | Fully reachable from release |              0 |
| `agent/restore-jump-rope-interval-heading`       | `7780ea3626bc` | Fully reachable from release |              0 |
| `agent/restore-lovable-client-env`               | `893dd13b2f05` | Fully reachable from release |              0 |
| `agent/resync-lovable-after-edge-deploy`         | `1d73ec4e3b84` | Fully reachable from release |              0 |
| `agent/resync-lovable-source`                    | `0e482675fb74` | Fully reachable from release |              0 |
| `agent/revert-lovable-drift`                     | `dc86433836b8` | Fully reachable from release |              0 |
| `agent/review-all-workouts`                      | `8f4f993648d5` | Fully reachable from release |              0 |
| `agent/review-energized-intake`                  | `e5edcb1e28db` | Fully reachable from release |              0 |
| `agent/review-seven-day-intake`                  | `3ca71287050f` | Fully reachable from release |              0 |
| `agent/review-welcome-handoff`                   | `86b652cb88c9` | Fully reachable from release |              0 |
| `agent/seven-day-accelerator-handoff`            | `c76b2f014b64` | Fully reachable from release |              0 |
| `agent/seven-day-signup-recovery`                | `aedc86956790` | Fully reachable from release |              0 |
| `agent/shared-assessment-app-system`             | `2f46e2740ee4` | Fully reachable from release |              0 |
| `agent/shared-page-typography-defaults`          | `3e40f45b65c6` | Fully reachable from release |              0 |
| `agent/shared-workout-page-structure`            | `cd3802157e4c` | Fully reachable from release |              0 |
| `agent/signup-migration-evidence`                | `9b35a932d9e0` | Contains unique commits      |              2 |
| `agent/signup-response-loss-test`                | `5f34afa50eb5` | Fully reachable from release |              0 |
| `agent/simple-app-entry`                         | `c869e4395d6d` | Fully reachable from release |              0 |
| `agent/simplify-day-one-equipment`               | `140509158889` | Fully reachable from release |              0 |
| `agent/simplify-day-one-summary`                 | `f37505fe85b0` | Fully reachable from release |              0 |
| `agent/simplify-plan-ready-install-copy`         | `a34d3045a575` | Fully reachable from release |              0 |
| `agent/simplify-programs-header`                 | `5c92bb221862` | Fully reachable from release |              0 |
| `agent/simplify-workout-approach-copy`           | `3f7bf719d7c3` | Fully reachable from release |              0 |
| `agent/soften-assessment-cta`                    | `a6dec11d29cf` | Fully reachable from release |              0 |
| `agent/soften-assessment-dividers`               | `04c57c57def9` | Fully reachable from release |              0 |
| `agent/soften-assessment-inputs`                 | `4f3cc1890c6c` | Fully reachable from release |              0 |
| `agent/staging-rollback-evidence`                | `7de76cf75a71` | Fully reachable from release |              0 |
| `agent/strengthen-nutrition-target-copy`         | `6c4c21ad7ab1` | Fully reachable from release |              0 |
| `agent/strengthen-preview-unlock-copy`           | `1a9dd3c9d012` | Fully reachable from release |              0 |
| `agent/strengthen-review-actions`                | `d2c441cd0148` | Fully reachable from release |              0 |
| `agent/stripe-diagnostic-logging`                | `45e1619aa26c` | Fully reachable from release |              0 |
| `agent/stripe-edge-runtime`                      | `96629a28d90d` | Fully reachable from release |              0 |
| `agent/stripe-runtime-diagnostic`                | `be9f0da9d925` | Fully reachable from release |              0 |
| `agent/stripe-safe-response-diagnostics`         | `ae944474710e` | Fully reachable from release |              0 |
| `agent/tidy-account-menu`                        | `1cdfcce6a8aa` | Fully reachable from release |              0 |
| `agent/tighten-assessment-header`                | `bcc49cc0b20c` | Fully reachable from release |              0 |
| `agent/try-aqua-programs`                        | `12c417181a07` | Fully reachable from release |              0 |
| `agent/unify-app-visual-system`                  | `86fc8850a115` | Fully reachable from release |              0 |
| `agent/unify-jump-rope-reset-guidance`           | `540669e3a5e2` | Fully reachable from release |              0 |
| `agent/v1-1-accelerator-product-requirements`    | `43322c6c955b` | Fully reachable from release |              0 |
| `agent/v1-1-accelerator-reconcile`               | `7e09f7ac341b` | Fully reachable from release |              0 |
| `agent/v1-1-cloudflare-media-a-e`                | `fbb72309eaec` | Contains unique commits      |              7 |
| `agent/v1-1-in-app-measurement-reminders`        | `f5b502d7562c` | Fully reachable from release |              0 |
| `agent/v1-1-measurement-history`                 | `3fdcac40b1da` | Fully reachable from release |              0 |
| `agent/v1-1-my-programs-setup`                   | `09f850a4abad` | Fully reachable from release |              0 |
| `agent/v1-1-ownership-program-runs`              | `b1732854c376` | Fully reachable from release |              0 |
| `agent/v1-1-ownership-program-runs-ready`        | `b1732854c376` | Fully reachable from release |              0 |
| `agent/v1-1-program-content-readiness`           | `7d13ca1e851b` | Fully reachable from release |              0 |
| `agent/v1-1-program-progress-engine`             | `61c55f224ce0` | Fully reachable from release |              0 |
| `agent/v1-1-stripe-checkout`                     | `61828516c228` | Fully reachable from release |              0 |
| `agent/v1-1-unified-customer-account`            | `3d5445f26326` | Fully reachable from release |              0 |
| `agent/v1-1-unified-member-access`               | `105a5e2f24e4` | Fully reachable from release |              0 |
| `agent/v1.1-functional-map`                      | `5f4c83103e98` | Contains unique commits      |              1 |
| `agent/website-lead-handoff`                     | `a129dd15149a` | Contains unique commits      |              5 |
| `agent/workout-screen-design`                    | `b9617cded853` | Fully reachable from release |              0 |
| `archive/pre-reset-2026-09-17`                   | `9edba783553d` | Exact release match          |              0 |
| `feat/customer-program-reminder-preferences`     | `702a387cdc2c` | Fully reachable from release |              0 |
| `feat/platform-comeback-sequence`                | `aa710d544a27` | Fully reachable from release |              0 |
| `feat/private-customer-progress`                 | `2c1803f50adf` | Fully reachable from release |              0 |
| `fix/accelerator-run-number-ambiguity`           | `998a6a20fc5b` | Fully reachable from release |              0 |
| `fix/guest-checkout-claim-cookie`                | `5f36ee072183` | Fully reachable from release |              0 |
| `fix/platform-auth-handoff-race`                 | `fe04bf222a29` | Fully reachable from release |              0 |
| `lovable-backup-release-v1.1-1788373182`         | `70e0d86a8b56` | Fully reachable from release |              0 |
| `main`                                           | `42c548a966c0` | Contains unique commits      |              3 |
| `nutrition-checkpoint-6`                         | `769a1449ffa7` | Fully reachable from release |              0 |
| `release/v1.1`                                   | `9edba783553d` | Exact release match          |              0 |
| `temp-unused`                                    | `70e0d86a8b56` | Fully reachable from release |              0 |
