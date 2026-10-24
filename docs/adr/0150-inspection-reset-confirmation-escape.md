---
---

# ADR 0150: Dismiss Reset Confirmation With Escape

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0149

## Decision

While a reset confirmation is visible, handle unmodified Escape bubbling within the inspection editor to dismiss it and return focus to Reset display preferences. Reuse dismissDisplayReset to cancel the timer without changing preferences or draft data. Expose Escape on the Dismiss button through aria-keyshortcuts.

Scope the handler to the editor and visible confirmation. Preserve the remaining-items list's existing Escape behavior, which consumes the event before it reaches the editor. Leave modified keys and Escape without a confirmation untouched.

## Validation

Run lint, build and desktop/phone correction/reset regressions. Verify Escape from Reset and Dismiss in the sticky panel, Escape on Review & save, restored focus, removed confirmation, unchanged preferences and retained draft evidence through save. Confirm list Escape behavior and Escape without confirmation remain intact.
