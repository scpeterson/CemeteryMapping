---
---

# ADR 0148: Dismiss Display Reset Confirmation Automatically

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0147

## Decision

Dismiss the display-preferences reset status after four seconds in either the sticky panel or workflow footer. Restart the timer on repeated Reset activation, clear an existing timer before scheduling another and clean up on component unmount. Timeout changes only confirmation visibility: preserve restored preferences, focus, current correction and draft data.

## Validation

Run lint, build and desktop/phone reset browser regressions using the browser clock. Verify confirmation remains before expiry, repeated Reset grants a fresh four seconds, both sticky and review confirmations disappear, focus/preferences remain unchanged, and retained draft readings/photos survive explicit save and default preferences survive reload.
