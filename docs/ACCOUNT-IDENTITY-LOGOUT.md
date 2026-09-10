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
- Verified signed-in access opens a compact disclosure showing only Signed in as, the current
  email, Account and Log Out. The verified platform email takes priority; free-plan-only access
  shows its verified plan email. Mixed-identity details remain on the existing Account screen.
- Verified signed-out access shows Sign In linking to the existing `/recover` form. Loading or
  failed identity lookup is never presented as verified signed-out state. Account remains reachable,
  and logout remains available after an identity error.
- The menu uses native disclosure keyboard behavior, normal Tab order, Escape with focus return,
  outside-click dismissal and touch-sized controls. Long emails wrap within the viewport.
  The account trigger's circle matches the existing notification bell's 40px (`size-10`) circle,
  as requested after live review; the glyph and menu contents remain unchanged.
- Logout uses the existing same-browser cleanup orchestration, prevents repeat submission,
  discards cached state and returns to the existing Account screen. The menu does not include
  explanatory logout copy; the existing Account screen retains its unsaved-answer disclosure.
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

After reviewing the deployed menu, Todd explicitly approved this tidy navigation-only presentation.
Loading, busy and actual error/retry messages remain functional exceptions. No Account screen,
identity resolution, session revocation, draft cleanup or consent behavior changes with this copy
removal. Future Account screen design (name, contact details, purchases, billing and invoices) is
still a separate discussion and implementation checkpoint.

## Account recovery after refund

Todd approved separating account sign-in from program ownership after the refunded-only
controlled account could not request a recovery email. This checkpoint repairs sign-in;
the separately discussed Account layout, contact editing and billing/invoice UI aren't included.

- A recovery request for an existing customer account queues one account-scoped transactional
  recovery job, even with no active purchase. It neither creates a customer nor grants ownership.
  The existing unique request key prevents duplicate jobs. Unknown addresses keep the same
  non-enumerating response. Addresses without a customer account retain free-plan recovery.
- New recovery jobs and tokens have a null entitlement ID. Purchase jobs must still identify
  an active entitlement. Historical entitlement-bound recovery links keep their original fences;
  previously revoked tokens aren't revived.
- Claim, final provider reservation and eligible-job counting accept account recovery independently
  of ownership, while preserving authenticated scheduler invocation, activation, controlled-customer
  scope, sending gates, provider ceiling, lease fencing and hard-bounce/complaint suppression.
  Neither marketing nor plan-email consent changes.
- The deliberate POST exchange checks token expiry/revocation and binds account-scoped credentials
  to their recovery job and customer. It checks the existing Auth user before generating a handoff
  and verifies the returned user ID, preventing a replacement identity for a stale account email.
- The existing My Programs landing page establishes the Auth session and provides the existing
  purchase/refund link; Account remains available in navigation. No receipt/invoice UI is added.
  Workout and program APIs continue to require active ownership. Refund records remain readable.
- Recovery email and scanner-safe return copy say Sign In rather than promising owned programs.
  GET still performs no exchange; each deliberate valid exchange creates a fresh browser handoff.

The forward migration is `20260910170000_account_recovery_without_ownership.sql`.
The full database replay tests refunded-only and purchase-free account recovery, deduplication,
unknown addresses, purchase restrictions, controlled scope, suppression, sending gates, provider
ceiling and unchanged refund history. Executable exchange tests cover existing identity, repeated
access, revoked/expired credentials, cross-customer job mismatch and continued workout denial.

Migration application remains a separate explicitly approved operation under
`DATABASE-MIGRATION-PROCESS.md`. The earlier Cloud exceptions name other migrations and don't
authorize this one. Before application, establish an approved execution procedure and record the
exact read-only history/schema comparison. Pause paid-access sending during the migration/deploy
transition under that operational approval: older workers don't understand account-scoped jobs.
After matching source/schema publication, restore the prior sending value and verify a fresh
controlled recovery request, delivery, clean-browser sign-in, purchase/refund visibility and denial
of refunded workout access. Don't open intake, restore ownership or reapply historical migrations.

## Account purchase navigation (September 10, 2026)

Approved scope: relocate the existing purchase history and refund-request experience
under Account → Purchases & Billing, removing the purchase/refund link from My Programs.
The Account section appears for a resolved platform account, including refunded-only
customers. Free-plan-only and signed-out identities do not get a billing link.

- `/account/purchases` is the canonical purchase/refund page, with Back to Account.
- `/my-programs/accelerator/refund` redirects to it so saved links still work.
- The new page retains the platform access boundary and existing customer-scoped server
  functions. Refund eligibility, confirmation, request status, and revoked access are unchanged.
- This relocation adds no receipts, invoices, contact editing, payment-method management,
  database changes, or email changes.
- Todd verified the refunded test account could sign in, see its $37 purchase and confirmed
  refund, and see no owned program before this navigation change. Direct workout-denial
  verification is separate from the owned-program listing.

Acceptance: Account exposes Purchases & Billing for platform accounts; purchase history
and refund actions load there; the legacy URL redirects; My Programs has no refund link;
unauthenticated access remains protected. Live navigation verification is pending deployment.

## Inline Account purchase details and consistent header

Todd approved replacing the extra billing click with purchase details directly on Account.
This supersedes the separate purchase-page navigation above.

- Account uses the same PlatformShell as the main app, keeping the account control and
  notification bell together in their existing positions. Account itself stays outside
  PlatformAccessBoundary so signed-out and free-plan-only users can still identify their
  session, recover access, or log out. AuthSessionBootstrap remains on Account.
- Platform account identities render AccountPurchases inline beneath Profile. The component
  is keyed by account email so purchase state resets when the resolved identity changes.
- Existing purchase history, refund eligibility, confirmation, submission, and retry handling
  are retained. Both former purchase URLs redirect to `/account#purchases`.
- Purchase rows use spacing and dividers rather than enclosing cards. Refunded purchases show
  their final status without an obsolete request deadline. Request consequences appear beside
  the confirmation action. Profile shows the verified email; name editing and preferences remain
  separate future work. No invoices, payment methods, database, or email behavior is added.
- Signed-out Account does not show purchases or a redundant Log Out button. Identity-load and
  logout failures retain retry/logout actions.

Acceptance: stable account/bell header across main app and Account; purchases visible immediately
for a platform account; old URLs resolve to Account's purchases section; signed-out/free-plan
Account remains accessible without exposing purchase details. Signed-in visual acceptance follows
publication in Todd's current session; automated checks do not manufacture authentication.

## Account navigation cleanup

Todd requested removing the duplicate logout block (including its explanation) and
Back to My Programs link from Account. These actions are available through the shared
navigation. Account no longer maintains a second logout handler or logout error state;
AccountNavigation retains the existing logout operation, visible failure/retry handling,
and concise menu. The explanation is not added to the menu. Account identity-loading
errors still offer Try Again. Profile, inline purchases, and signed-out recovery remain.
This supersedes the earlier Account-page logout placement; logout behavior itself is unchanged.
