# Account identity and local logout

Todd approved this bounded checkpoint on September 10, 2026, from GitHub
`release/v1.1` at `4d8aff69d7d8aa28abb25f77044dd5d4a3c4a85c`.
It addresses the account-switching difficulty observed during the controlled refund test.

## Customer behavior

- Account is a labeled header link in both the platform and free-plan/assessment layouts, including
  mobile browsers and the installed PWA. The protected-route access screen also links to it.
- `/account` displays the email verified by the server's Supabase Auth check. A free-plan-only
  browser can display its saved email only after existing plan-access verification succeeds.
- If an older free-plan credential belongs to a different email from the platform login, the screen
  explicitly displays both rather than implying they are one identity. Logout clears both.
- Account does not require active paid ownership or reviewer permission. It creates no new identity.
- Log Out is deliberate and local to this browser's storage context. Independent sessions on other
  browsers/devices stay signed in. Installed-app and browser storage are not assumed to be shared;
  a platform that shares storage will share logout, while isolated contexts must log out separately.
- Saved programs, progress, purchase and refund history, measurements, nutrition, account records,
  and email consent remain unchanged. Unsaved assessment answers and local intake details are cleared;
  this is disclosed beside the action. Home Screen installation preferences are retained.
- After successful cleanup, a full navigation discards private in-memory state and opens Account
  with a passwordless recovery link. Merely visiting this screen sends no email or opens signup.
- A partial server, network, Auth, or storage failure never displays a successful logout. The screen
  provides a retry action and remains available even after some credentials have been cleared.

## Access inventory and implementation

| Access or data                                               | Logout action                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Supabase Auth browser session                                | `signOut({ scope: "local" })`; never use the global default                       |
| `gxj_plan_token_v1`                                          | Revoke only its matching `plan_access_sessions` row, then remove local credential |
| `return_link_session`                                        | Revoke only its matching `return_link_sessions` row, then expire HTTP-only cookie |
| `gxj_lead_intake_v1` cookie                                  | Expire this browser's signup/welcome handoff                                      |
| `gxj_accelerator_checkout_claim`                             | Expire this browser's checkout claim cookie                                       |
| Assessment, eligibility, draft owner, submission replay data | Remove their exact localStorage keys                                              |
| Intake name/email draft                                      | Remove tab-local sessionStorage data                                              |
| Query cache and route-local React state                      | Clear cache and perform a full navigation                                         |
| Other open tabs and restored pages                           | Broadcast a logout marker; discard private page state and tab draft               |

`POST /logout` requires an exact same-origin Origin header. GET has no logout side effect and returns 405. All three expired cookies retain Path=/, Secure, HttpOnly, and SameSite=Lax. Responses are
no-store. Session updates select only hashes of supplied browser credentials; no client-supplied
customer/email selector can revoke another account's sessions. No migration or new RPC is needed.

The client attempts all cleanup stages even after a failure. Other tabs clear only their own
sessionStorage draft and page state: a delayed logout event must not erase shared credentials from
a newer sign-in. A restored back-forward-cache page reloads to revalidate access. A persistent marker
also clears stale tab drafts when a previously inactive tab loads again.

This is browser logout, not credential-compromise remediation. Existing secure email links remain
usable through their deliberate exchange flow. A legacy free-plan bearer credential is removed from
browser storage; its historical plan-level hash is not globally rotated. Supabase access JWTs already
copied outside the browser retain their existing expiration behavior; local sign-out revokes the
current refresh session. No promise of immediate global invalidation is made.

## Verification and release boundary

Focused tests exercise verified identity, independent free/paid identities, no identifying details
without access, exact session targeting, cross-origin/GET rejection, repeated logout, cookie expiry,
cleanup failures, preservation of unrelated local settings, delayed tab events, and restored pages.
They use isolated fixtures and do not change the controlled backend or contact email providers.

The browser tool rejected the local preview URL with `ERR_BLOCKED_BY_CLIENT`. This is not a completed
visual or authenticated browser verification. Before accepting the deployed checkpoint:

1. Verify the exact approved release and source agreement through the release process.
2. With a controlled account, inspect the visible email on desktop, narrow mobile, and installed PWA.
3. Open the plan and Account in separate tabs, log out, and check that neither tab retains private
   access or the old assessment draft after refresh, Back, and reopening.
4. Verify the free-plan-only session path and a browser containing different free/paid identities.
5. Confirm a separately signed-in device remains usable, and that the saved plan and history persist.
6. Use the existing recovery flow to sign into the designated reviewer account and open its queue.
7. Exercise a failed cleanup and retry without claiming success or opening public intake.

Merge, deployment, controlled email/browser tests, and public launch retain their approval boundaries.
This checkpoint does not implement contact editing, billing management, all-device logout, account
deletion, password login, or public intake activation. Those follow-ups remain in issue #97.

## Account navigation checkpoint

Todd separately approved navigation only after the controlled logout/recovery tests. Screen redesign
is excluded from this checkpoint. The existing Account, recovery, private-plan and email-return
screens retain their behavior and copy.

- The platform header replaces its Account text link with an account icon beside the existing
  notification bell. The free-plan/assessment header uses the same account control in its existing
  account position; it does not add a new notification feature.
- Verified signed-in access opens a compact disclosure showing the current email, Account and
  deliberate Log Out. Mixed verified free/platform identities are both identified.
- Verified signed-out access shows Sign In linking to the existing `/recover` form. Loading or
  failed identity lookup is never presented as verified signed-out state. Account remains reachable,
  and logout remains available after an identity error.
- The menu uses native disclosure keyboard behavior, normal Tab order, Escape with focus return,
  outside-click dismissal and touch-sized controls. Long emails wrap within the viewport.
- Logout uses the existing same-browser cleanup orchestration, shows the unsaved-answer disclosure,
  prevents repeat submission, discards cached state and returns to the existing Account screen.
  A failed cleanup hides stale identity and keeps an explicit retry in the menu.
- Contact, billing, preferences and support entries are not exposed until implemented. No new
  routes, migration, provider configuration, sign-in method or public-intake activation is included.

Existing test evidence is maintained in issue #97: browser two-tab logout, installed-app reopen,
correct-account recovery and same-account desktop Incognito/phone Private isolation passed their
controlled cases. Mixed-identity, populated-draft and cleanup-failure live acceptance remain distinct
from fixture coverage. The later sign-in screen usability checkpoint remains a separate decision.

The platform header stays mounted outside the private-content boundary. Auth sign-out therefore
cannot hide a partial-logout error or its retry control. The boundary continues to guard page
content; the header makes no access grants. Notification counts clear and reload when the Auth
identity changes so a previous account's badge does not survive account switching.
