---
---

# ADR 0123: Return Required Corrections To Their Summary

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0122

## Decision

Track whether a visit/face correction originated in Required information. Return to review from such a correction scrolls to and focuses the required-summary heading after the review DOM commit. Keep that heading mounted when the last issue is resolved, so the same destination announces completion. Returning without resolving an issue still shows the updated remaining list at that location.

Keep the editor target and summary-return origin separate. Face-card changes retain the correction origin. Ordinary stage navigation clears it; generic Edit visit & condition and Edit face actions preserve their existing return focus. Navigation changes no draft values and performs no writes.

## Validation

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. Browser coverage checks summary focus and viewport visibility after required visit and face corrections, unresolved/remaining/completed issue states, keyboard use, regular-action destination reset, retained draft/photos, final save and phone layout. No API or database changes are needed.
