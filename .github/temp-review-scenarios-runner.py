from pathlib import Path

script_path = Path(".github/temp-review-scenarios.py")
script = script_path.read_text()

old_open = "old = '''- Reconcile the review catalog with the real Precision Utility production components so review\n  scenarios cannot silently drift from participant-facing routes.'''
"
new_open = "old = '''- Continue reducing review-catalog drift in route-specific synthetic scenario compositions. Review\n  shell, navigation, buttons, sections, choices, and typography now inherit governed production\n  styles/primitives instead of maintaining parallel lookalikes.'''
"
script = script.replace(old_open, new_open)

old_active = "old_active = '''The Precision Utility participant-facing production-route migration is complete at this checkpoint.\nWelcome and assessment completion now use shared loading/state treatment, compact setup progress,\nrestrained Barlow hierarchy, direct page structure, and bounded notices instead of the superseded\ndisplay-title, large progress-tile, and card-by-default presentation. Signup handoff, assessment,\nplan generation, save, replacement, recovery, and token behavior remain unchanged. Internal\nreview/preview/admin surfaces and the public sales page are separate follow-up surfaces rather than\nparticipant design authority.'''
"
new_active = "old_active = '''The Precision Utility participant-facing production-route migration is complete. The active internal\ncheckpoint is review-catalog reconciliation: production PlatformShell and ReviewShell now share one\nvisual style source, and review-only section/action/choice/status helpers delegate to governed\nPrecision Utility or shared production primitives. Review scenarios keep fake data for state review,\nbut production routes remain visual authority. Route-specific synthetic compositions, preview/admin\nsurfaces, and the public sales page remain separate follow-up work.'''
"
script = script.replace(old_active, new_active)

exec(compile(script, str(script_path), "exec"))
