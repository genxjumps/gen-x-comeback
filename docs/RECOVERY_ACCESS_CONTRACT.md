# Recovery Access Contract

This contract defines how Gen X Jumps plan recovery must behave across real-world devices, browsers, tabs, and repeated recovery attempts.

## Core rule

A valid recovery email link is a portable access credential for the current saved plan version. It is not tied to the device or browser that requested the email.

Each successful use of a valid link establishes or refreshes access in the browser/device that used it.

## Required behavior

- A recovery request may be submitted from any device or browser.
- The resulting email may be opened on the same device or a different device.
- A valid link may be used more than once while it remains unexpired and unrevoked.
- Each successful link use creates a fresh return session for that browser/device.
- Multiple devices and browsers may hold valid sessions for the same plan at the same time.
- Using a link on one device must not invalidate an existing valid session on another device.
- Requesting a newer recovery email must not invalidate older still-valid recovery links for the same current plan version.
- Requesting a newer recovery email must not invalidate existing browser sessions.
- Opening an older still-valid recovery email after a newer recovery email has been requested must still establish access.
- Same-device and cross-device behavior must be functionally equivalent after the link is validated.
- The requesting device must never be required to complete the recovery.

## Intentional invalidation boundaries

A recovery link or session may stop working only when an explicit security/product boundary requires it, including:

- the credential expires;
- the credential/session is explicitly revoked;
- the saved plan is replaced by a new plan version;
- a future explicit "sign out all devices" or account-compromise action revokes all sessions/links.

Normal recovery requests and normal use of another device are not revocation events.

## Security model

The email link proves access to the current plan. The device that requested the email proves nothing.

The raw recovery token is validated server-side. A successful exchange creates a new opaque return-session credential for the browser that used the link. Concurrent browser sessions are expected and supported.

## Pre-launch acceptance matrix

Every row below must work without the user understanding sessions, cookies, browsers, or device state.

| Request device | Open email on | Prior state | Expected result |
| --- | --- | --- | --- |
| Laptop | Same laptop | No session | Plan opens and laptop gains access |
| Phone | Same phone | No session | Plan opens and phone gains access |
| Laptop | Phone | No session | Plan opens and phone gains access |
| Phone | Laptop | No session | Plan opens and laptop gains access |
| Laptop browser A | Laptop browser B | No session in B | Plan opens and B gains independent access |
| Laptop | Phone | Laptop already recovered | Phone also gains access; laptop remains valid |
| Phone | Laptop | Phone already recovered | Laptop also gains access; phone remains valid |
| Any | Same link used a second time | Existing session | Link still works while valid and creates/refreshes access |
| Any | Older valid email after newer recovery request | Existing/new session | Older valid email still works |
| Any | Newer recovery email | Older valid session on another device | New link works; older session remains valid |
| Any | Two tabs nearly simultaneously | No session | Both settle into the same accessible plan state |
| Any | Already authenticated member | Existing platform session | Recovery does not strand or downgrade the member |
| Any | Expired link | Any | Access denied safely; user can request a new link |
| Any | Revoked link | Any | Access denied safely |
| Any | Link for replaced plan version | Any | Old plan is not restored; access denied safely |

## Regression requirements

Automated tests must protect these invariants where deterministic automation is practical:

1. The same valid return token can be exchanged multiple times.
2. Each exchange produces a distinct return session.
3. Successful exchange does not revoke the source token or prior return sessions.
4. `request_plan_recovery` does not revoke older valid tokens or active sessions.
5. Plan replacement remains an explicit revocation boundary.
6. Production `/return` must write the session cookie through the framework-supported response path and the protected plan route must read it through the framework-supported request path.

The cross-device matrix remains a required manual production acceptance pass because browser cookie behavior and deployment adapters are part of the behavior being verified.
