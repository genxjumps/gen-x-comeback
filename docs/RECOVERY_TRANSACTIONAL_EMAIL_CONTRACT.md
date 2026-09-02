# Recovery Transactional Email Contract

Plan recovery is transactional access email, not marketing.

- A user who explicitly requests recovery can receive the recovery email whether Plan-email consent is active or inactive.
- Marketing consent is separate and never controls recovery delivery.
- Recovery remains subject to operational safety gates such as authenticated scheduler execution, production activation, controlled production scope, hard-bounce/complaint suppression, and provider volume limits.
- Proactive 7-Day lifecycle email remains gated by active Plan-email consent and the current Plan consent boundary.
- The final provider-attempt fence must enforce the same distinction as the initial job-claim fence.
