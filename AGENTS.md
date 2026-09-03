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

- `main` is the current accepted app baseline. Do not develop directly on it.
- `release/v1.1` is the V1.1 integration branch. Merge bounded task branches into it through pull requests.
- Create work from the current target branch with names such as `agent/<checkpoint>`.
- Lock the checkpoint scope and acceptance criteria before editing. Implement the complete bounded checkpoint, run the quality gate, and present one final review. Stop mid-checkpoint only for a real conflict, an unsafe live action, or a product decision that changes the approved scope.
- Run `bun run verify` before requesting merge. GitHub CI must also pass.
- After changing, adding, removing, or renaming a build input under `.env`, root build configuration, `public/`, `scripts/`, `src/`, or `supabase/`, run `bun run release:manifest` before `bun run verify`.
- Keep documentation in the same pull request as the behavior it governs.
- Do not use Lovable chat, visual edits, or code edits for routine development. GitHub is the source of truth. Lovable is used only for controlled visual review and explicitly approved publication.
- Production publication uses the authenticated Lovable MCP publisher only after `bun run release:preflight` succeeds. Do not publish through the Lovable dashboard.
- The app is still pre-launch. The current Lovable/Supabase backend is the development backend until real external users, live payments, or a public launch begin.
- Development may use the current backend with controlled test data. Never use destructive cleanup as a substitute for forward migrations.
- Never commit server-only secrets or local override files. The tracked root `.env` is a narrow exception required by Lovable Cloud and may contain only browser-public `VITE_SUPABASE_*` configuration. Keep private values in the backend secret store.
- Before the first real-user/public release, establish and document the production boundary and decide whether a separate staging backend is warranted by the release risk.
- Do not force-push, rebase, amend, or squash commits that have already been pushed to a Lovable-synced branch.
- V1.1 is functional-first. Visual design may be reviewed separately when Todd explicitly opens that checkpoint.
