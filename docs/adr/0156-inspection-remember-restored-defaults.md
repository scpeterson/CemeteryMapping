---
---

# ADR 0156: Remember Restored Defaults Disclosure State

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0155

## Decision

Keep restoredDefaultsOpen in the mounted inspection workflow and control both Restored defaults disclosures with it. Change the choice only on explicit summary activation. Start closed and preserve either choice across confirmation dismissal/expiry, subsequent confirmations and sticky-panel/Review & save transitions.

Keep this disclosure state independent of the three settings being reset, keyboard help, confirmation lifetime and draft data. Resetting display settings does not close the list used to inspect them. No browser/server persistence is introduced.

## Validation

Run lint, build and desktop/phone reset regressions. Verify closed and open choices across new confirmations, open retention on Review & save, closed retention after another review reset, and existing focus, dismissal, timeout, draft evidence and explicit save behavior.
