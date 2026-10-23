---
---

# ADR 0149: Dismiss Display Reset Confirmation Immediately

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0148

## Decision

Add Dismiss beside the reset status in both the sticky correction panel and workflow footer. Dismiss hides only the confirmation and clears its pending timer, restoring focus to Reset display preferences. Keep the status text in its own live region and the native button outside it. If automatic expiry removes a focused confirmation control, return focus to Reset; otherwise expiry leaves focus untouched.

Reuse the current reset behavior and four-second timeout. Dismiss never changes saved preferences, draft data, correction identity or navigation. Preserve the scoped draft-discard exemption for Reset.

## Validation

Run lint, build and desktop/phone reset browser regressions. Verify keyboard Dismiss in the sticky panel, click Dismiss on review, removed confirmation/action, restored focus, unchanged display defaults and draft evidence, retained timeout behavior and explicit save/reload.
