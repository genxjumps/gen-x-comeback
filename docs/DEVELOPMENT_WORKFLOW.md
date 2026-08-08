# Gen X Jumps App Development Workflow

This is the required workflow for V1.1 and later releases. It keeps the live app stable while development happens in GitHub-controlled checkpoints.

## Branch roles

| Branch               | Role                                  | Lovable                                                  | Production                        |
| -------------------- | ------------------------------------- | -------------------------------------------------------- | --------------------------------- |
| `main`               | Current production source             | Normal synced branch                                     | Only branch that may be published |
| `release/v1.1`       | Integrated V1.1 candidate             | May be selected for a controlled preview after CI passes | Never publish directly            |
| `agent/<checkpoint>` | One bounded implementation checkpoint | Never select in Lovable                                  | Never publish                     |

`main` and `release/v1.1` are integration boundaries, not development workspaces. Changes reach them through pull requests.

## One-checkpoint loop

1. Define one bounded outcome, acceptance criteria, exclusions, and affected documentation.
2. Create `agent/<checkpoint>` from the current `release/v1.1` head.
3. Build and test locally. Do not use Lovable to generate or edit source.
4. Run `bun install --frozen-lockfile` and `bun run verify`.
5. Review the complete diff once. Remove incidental cleanup and unrelated changes.
6. Open a pull request into `release/v1.1`.
7. Merge only after the GitHub Quality Gate passes and Todd approves the completed checkpoint.

The agent should not interrupt Todd for small implementation choices that stay inside the locked scope. Stop only when evidence conflicts, a decision would change product behavior, or a live or destructive action needs explicit authorization.

## V1.1 integration review

After a group of related checkpoints is merged into `release/v1.1`:

1. Confirm the branch is green and its diff from `main` contains only accepted V1.1 work.
2. Switch Lovable's synced branch from `main` to `release/v1.1` only for the controlled preview.
3. Do not edit code in Lovable and do not publish.
4. Test read-only and isolated flows. The preview shares backend data with production, so it is not a database staging environment.
5. Switch Lovable back to `main` after the review unless another approved integrated checkpoint immediately follows.

## Backend safety

A Git branch isolates source code, not the Lovable Cloud database. Lovable preview and the published app share the same backend and data for this project.

Before the first V1.1 schema or data migration:

1. Establish an isolated staging database or independent staging project.
2. Prove the migration and rollback or forward-repair plan there.
3. Regenerate and review TypeScript database types in the same checkpoint.
4. Verify affected lifecycle, consent, recovery, scheduler, and plan-state tests.
5. Do not apply the migration to production until the complete release candidate is approved.

Production data, plans, jobs, tokens, sessions, email activity, scheduler controls, secrets, and provider state must not be used as development fixtures.

## V1.1 release

1. Freeze the accepted `release/v1.1` commit and run the complete quality gate.
2. Review the full `main...release/v1.1` diff and reconcile Product Blueprint, Technical Specification, Decision Log, and repository documentation.
3. Create one release pull request from `release/v1.1` into `main`.
4. Merge without rewriting published history.
5. Confirm GitHub `main` and Lovable show the same source revision and no Lovable-generated drift.
6. Get Todd's explicit production approval.
7. Publish once through Lovable.
8. Run a bounded production smoke test without creating unintended plans, tokens, sessions, jobs, or email activity.
9. Record the release commit and production evidence.

## Hard rules

- GitHub is the source of truth. Lovable is preview and publish only.
- No direct development on `main` or `release/v1.1`.
- No force push, rebase, amend, or squash of pushed Lovable-synced history.
- No source changes during preview or release.
- No migration, provider send, scheduler change, secret change, or production publication hidden inside another checkpoint.
- Documentation changes travel with the feature they govern.
- V1.1 functionality comes before visual polish. The current V1 visual system remains unchanged until Todd explicitly reopens design work.
