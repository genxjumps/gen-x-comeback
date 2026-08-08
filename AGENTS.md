<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## GitHub-first development contract

- `main` is the production source branch. Do not develop directly on it.
- `release/v1.1` is the V1.1 integration branch. Merge bounded task branches into it through pull requests.
- Create work from the current target branch with names such as `agent/<checkpoint>`.
- Lock the checkpoint scope and acceptance criteria before editing. Implement the complete bounded checkpoint, run the quality gate, and present one final review. Stop mid-checkpoint only for a real conflict, an unsafe live action, or a product decision that changes the approved scope.
- Run `bun run verify` before requesting merge. GitHub CI must also pass.
- Keep documentation in the same pull request as the behavior it governs.
- Do not use Lovable chat, visual edits, or code edits for development. GitHub is the source of truth. Lovable is used only for a controlled preview of an already-green integration branch and for an explicitly approved production publish.
- Lovable preview and production share backend data for this project. A code branch is not an isolated backend. Do not run migrations or create, modify, or delete live plans, jobs, tokens, sessions, email state, scheduler state, secrets, or provider activity during development.
- Before the first V1.1 database change, establish and verify an isolated staging database or staging project. Keep all migrations forward-only.
- Do not force-push, rebase, amend, or squash commits that have already been pushed to a Lovable-synced branch.
- V1.1 is functional-first. Visual polish is out of scope until Todd explicitly reopens it.
