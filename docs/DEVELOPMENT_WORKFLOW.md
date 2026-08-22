# Gen X Jumps App Development Workflow

This is the required workflow for V1.1 and later development. It keeps changes bounded and reviewable while GitHub remains the source of truth and Lovable stays later in the loop.

## Current environment status

The app is still pre-launch. There are no real external users or live paid customers using the product yet. The current Lovable/Supabase backend is therefore the development backend.

A separate staging backend is not required just to continue V1.1 development. Revisit that decision before the first real-user/public release, or earlier if a checkpoint introduces enough risk that isolation is clearly worth the setup.

## Branch roles

| Branch               | Role                                  | Lovable                                      |
| -------------------- | ------------------------------------- | -------------------------------------------- |
| `main`               | Current accepted app baseline         | Normal synced branch                         |
| `release/v1.1`       | Integrated V1.1 candidate             | Controlled visual review after CI passes     |
| `agent/<checkpoint>` | One bounded implementation checkpoint | Do not select for routine Lovable development |

`main` and `release/v1.1` are integration boundaries, not development workspaces. Changes reach them through pull requests.

## One-checkpoint loop

1. Define one bounded outcome, acceptance criteria, exclusions, and affected documentation.
2. Create `agent/<checkpoint>` from the current `release/v1.1` head.
3. Build and test through GitHub-controlled development. Do not use Lovable to generate routine source changes.
4. Run `bun install --frozen-lockfile` and `bun run verify`.
5. Review the complete diff once. Remove incidental cleanup and unrelated changes.
6. Open a pull request into `release/v1.1`.
7. Merge only after the GitHub Quality Gate passes and Todd approves the completed checkpoint.

The agent should not interrupt Todd for small implementation choices that stay inside the locked scope. Stop only when evidence conflicts, a decision would change product behavior, or a destructive/external action needs explicit authorization.

## Backend development rules

Because the product is still pre-launch, controlled V1.1 development may use the current backend.

- Use test records deliberately and keep them clearly identifiable.
- Do not treat real personal/customer data as test fixtures.
- Do not commit secrets or local `.env` files.
- Keep schema changes in version-controlled, forward-only migrations.
- Regenerate and review TypeScript database types when schema changes require it.
- Keep payment-provider test mode and real-money mode explicitly separated when Stripe is added.
- Keep outbound email test behavior bounded so development does not accidentally message unintended recipients.
- Before the first public launch or real-user intake, establish the production boundary, clean test data as appropriate, verify secrets/configuration, and decide whether ongoing development should move to a separate staging backend.

## Lovable usage

Lovable is later in the stack:

1. Build and test in GitHub first.
2. Integrate accepted checkpoints on `release/v1.1`.
3. Use Lovable for controlled visual/interaction review when that review adds value.
4. Do not use Lovable chat or visual editing as the default coding workflow.
5. Publish only after Todd explicitly approves the release.

This keeps routine development from consuming Lovable effort/credits unnecessarily.

## Release preparation

Before the first real public release:

1. Freeze the accepted release candidate and run the complete quality gate.
2. Review the full `main...release/v1.1` diff and reconcile Product Blueprint, Technical Specification, Decision Log, and repository documentation.
3. Verify database migrations, test-data cleanup, secrets, email controls, payment controls, analytics boundaries, and rollback/forward-repair procedures.
4. Decide whether production and staging now need separate backends based on the real operating risk.
5. Create one release pull request from `release/v1.1` into `main`.
6. Merge without rewriting published history.
7. Confirm GitHub `main` and Lovable show the same source revision and no Lovable-generated drift.
8. Get Todd's explicit launch approval.
9. Publish once through Lovable.
10. Run a bounded smoke test and record the release evidence.

## Hard rules

- GitHub is the source of truth. Lovable is visual review and publication, not the routine development environment.
- No direct development on `main` or `release/v1.1`.
- No force push, rebase, amend, or squash of pushed Lovable-synced history.
- No hidden migration, provider send, scheduler change, secret change, or publication inside another checkpoint.
- Documentation changes travel with the behavior/process they govern.
- Environment files and secrets stay out of source control.
- Do not add process overhead merely because the app may need it later; add isolation and release controls when real operating risk justifies them.
