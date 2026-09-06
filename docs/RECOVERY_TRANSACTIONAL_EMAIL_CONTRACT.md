# Recovery Transactional Email Contract

Plan recovery is transactional access email, not marketing.

- A user who explicitly requests recovery can receive the recovery email whether Plan-email consent is active or inactive.
- Marketing consent is separate and never controls recovery delivery.
- Recovery remains subject to operational safety gates such as authenticated scheduler execution, production activation, controlled production scope, hard-bounce/complaint suppression, and provider volume limits.
- Proactive 7-Day lifecycle email remains gated by active Plan-email consent and the current Plan consent boundary.
- The final provider-attempt fence must enforce the same distinction as the initial job-claim fence.
- Paid purchase backup access and paid recovery are transactional. They use a separate fail-closed
  activation gate, never consult free-plan or marketing consent, remain subject to hard-bounce and
  complaint suppression, and count inside the same rolling provider-submission ceiling.
- A paid purchase queues its backup access job atomically with purchase and entitlement ownership.
  Provider delivery never blocks immediate same-browser access.
