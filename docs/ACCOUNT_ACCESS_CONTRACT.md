# Account and Access Contract

**Role:** Contract

This contract defines durable account, header, logout, recovery, and purchase-history behavior.
Implementation checkpoint history is preserved in
[`history/ACCOUNT-IDENTITY-LOGOUT.md`](history/ACCOUNT-IDENTITY-LOGOUT.md).

## Identity and navigation

- A verified customer account can connect free-plan access, paid ownership, measurements,
  Nutrition, purchase history, and refund history without changing those records.
- Account and Notifications remain persistent header utilities throughout the participant app.
- The account menu shows the verified identity when available and uses the existing passwordless
  recovery path when signed out.
- A free-plan-only browser may show its saved email only after plan access is verified. If free and
  platform credentials represent different emails, the Account screen identifies both instead of
  implying they are one account.
- Purchases and Billing belongs on the Account screen. Legacy purchase URLs redirect there.

## Logout

- Logout is deliberate and local to the current browser storage context. It does not sign out other
  devices or revoke reusable email links.
- Logout clears the current browser's Auth session, plan and return sessions, handoff cookies,
  checkout claim, private cached state, and unsaved intake or assessment drafts.
- Saved programs, progress, purchases, refund history, measurements, Nutrition, consent, and
  account records remain intact.
- Cleanup attempts every stage. A partial server, network, Auth, or storage failure must not be
  reported as a successful logout and must provide a retry path.
- Cross-origin requests and GET requests cannot trigger logout.

## Recovery and ownership

- Account recovery proves account access. It does not create a customer, grant ownership, restore a
  refunded entitlement, or alter consent.
- A customer with only refunded purchases may recover the account and view purchase/refund history
  while workout and Nutrition access remain governed by active qualifying ownership.
- Recovery remains passwordless and non-enumerating. Unknown addresses receive the same public
  acknowledgement as known addresses.

## Purchases and billing

- The Account screen presents program name, amount, readable purchase date, status, and any
  currently eligible refund action.
- A seven-day refund deadline appears only beside an eligible request action. Requested and
  refunded purchases show their final status without an obsolete deadline.
- Purchase history and refund results come from server-authorized records. The client does not
  infer financial or ownership state.
- Contact editing, stored payment methods, invoices, account deletion, password login, and global
  all-device logout are not part of this contract.
