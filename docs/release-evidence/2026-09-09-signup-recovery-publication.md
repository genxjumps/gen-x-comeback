# Signup recovery publication - September 9, 2026

Todd explicitly approved deployment after the verified migration. Preflight
returned `ready-to-publish` from a clean release checkout. One authenticated
Lovable publish call created the deployment below. A fresh Lovable source read
and the unmodified `release:verify-production` command then passed, including
GitHub release agreement, the exact post-merge Quality Gate, live commit and
source fingerprint, and `cache-control: no-store`.

```json
{
  "status": "production-verified",
  "verifiedAt": "2026-09-09T19:21:20.457Z",
  "deploymentId": "6ed731c5-4eed-45e2-97f2-a949d23ddf0f",
  "releaseSha": "ba530a1e62b6b83127e5be4385b3df9c514bb3a4",
  "sourceFingerprint": "sha256:0cec97593af87364ee44b48b29b5d6e7e6f1a97ed02e0c8df764216fe7324bd7",
  "lovableLatestCommitSha": "ba530a1e62b6b83127e5be4385b3df9c514bb3a4",
  "qualityGate": {
    "jobId": 102606801925,
    "jobUrl": "https://github.com/genxjumps/gen-x-comeback/actions/runs/34393326405/job/102606801925",
    "runId": 34393326405,
    "runUrl": "https://github.com/genxjumps/gen-x-comeback/actions/runs/34393326405"
  },
  "production": {
    "application": "gen-x-comeback",
    "commit": "ba530a1e62b6b83127e5be4385b3df9c514bb3a4",
    "identityProof": "commit-and-source-fingerprint",
    "sourceFingerprint": "sha256:0cec97593af87364ee44b48b29b5d6e7e6f1a97ed02e0c8df764216fe7324bd7"
  }
}
```

This verifies publication identity. Controlled participant email/browser tests
remain unperformed and separately approved. Public intake remains closed in the
published source. No secrets, operational gates, or database schema were changed
during publication. The earlier executor HTTP 403 recorded during migration did
not recur in the production verifier; it retrieved and verified the live identity.
