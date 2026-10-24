---
---

# ADR 0152: Remember Reset Confirmation Keyboard Help

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0151

## Decision

Keep resetKeyboardHelpOpen in the mounted inspection workflow, independent of draft data, the main keyboard-help preference and confirmation visibility. Control both confirmation disclosures with the same state, changing it only on explicit summary activation. Preserve either choice when a confirmation expires, is dismissed or moves between the sticky panel and Review & save. New confirmations restore that choice; the initial default remains closed.

Reset display preferences continues restoring its established main-list/main-hint defaults without closing the help used to understand the reset confirmation. Keep existing confirmation timing and focus behavior. No new browser or server persistence is introduced.

## Validation

Run lint, build and desktop/phone reset regressions. Verify open help survives repeated confirmation/timeout and a sticky-to-review transition, closed help survives subsequent confirmations, and Escape, Dismiss, automatic expiry, retained draft evidence and explicit save/reload remain intact.
