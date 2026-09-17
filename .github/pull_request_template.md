## Outcome

One bounded result this PR delivers:

## Scope

- [ ] Created from the current `release/v1.1` head; no overlapping app work is active.
- [ ] Affected screens/components are named in this PR.
- [ ] The diff contains no unrelated cleanup, copy, feature, workflow, or documentation changes.
- [ ] Global design impact is identified. Shared styles/components are used instead of page-specific copies.

## Design approval

- [ ] The visual direction was approved before implementation, or this PR has no visual change.
- [ ] Review surfaces use the real shared components rather than separate lookalikes.

## Verification

- [ ] Focused tests and visual review cover the changed surfaces and direct shared-component impact.
- [ ] `bun run verify` passed locally.
- [ ] The GitHub Quality Gate passes before merge.
- [ ] No broad manual regression test is required unless this changes a foundational flow or global component.

## Controlled boundaries

- [ ] No database, migration, authentication, intake, payment, email, secret, provider, or production action is included without separate explicit approval.
- [ ] No force push, history rewrite, branch deletion, or unrelated branch work occurred.

## Release impact

- Runtime impact:
- Manual review:
- Publication required:
