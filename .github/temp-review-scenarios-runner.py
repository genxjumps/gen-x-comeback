from pathlib import Path

script_path = Path(".github/temp-review-scenarios.py")
script = script_path.read_text()

old_open = """old = '''- Reconcile the review catalog with the real Precision Utility production components so review
  scenarios cannot silently drift from participant-facing routes.'''
"""
new_open = """old = '''- Continue reducing review-catalog drift in route-specific synthetic scenario compositions. Review
  shell, navigation, buttons, sections, choices, and typography now inherit governed production
  styles/primitives instead of maintaining parallel lookalikes.'''
"""
script = script.replace(old_open, new_open)

old_active = """old_active = '''The Precision Utility participant-facing production-route migration is complete at this checkpoint.
Welcome and assessment completion now use shared loading/state treatment, compact setup progress,
restrained Barlow hierarchy, direct page structure, and bounded notices instead of the superseded
display-title, large progress-tile, and card-by-default presentation. Signup handoff, assessment,
plan generation, save, replacement, recovery, and token behavior remain unchanged. Internal
review/preview/admin surfaces and the public sales page are separate follow-up surfaces rather than
participant design authority.'''
"""
new_active = """old_active = '''The Precision Utility participant-facing production-route migration is complete. The active internal
checkpoint is review-catalog reconciliation: production PlatformShell and ReviewShell now share one
visual style source, and review-only section/action/choice/status helpers delegate to governed
Precision Utility or shared production primitives. Review scenarios keep fake data for state review,
but production routes remain visual authority. Route-specific synthetic compositions, preview/admin
surfaces, and the public sales page remain separate follow-up work.'''
"""
script = script.replace(old_active, new_active)

exec(compile(script, str(script_path), "exec"))
