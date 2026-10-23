---
---

# ADR 0121: Correct Visit And Condition From Inspection Review

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0119 and ADR 0120

## Decision

Add Edit visit & condition above the visit summary in Review & save. It opens Visit & condition and focuses Inspection type after the DOM commit. In this review-origin correction context, Return to review replaces Next and skips the face stage. Return restores focus to the visit summary’s edit action.

Represent correction context as visit, face or none. Explicit review actions establish it; ordinary stage navigation clears it. Preserve existing face correction selection and return focus. Navigation does not replace or save the draft, so visit values, face readings/designs, selected library photos and pending files/notes remain intact. Keep existing date/source/condition validation, NHG fixed-date rules and photo save/retry behavior.

## Validation

Run `npm run lint`, `npm run build` and `npm run test:inspections:browser`. Browser tests cover keyboard focus in both directions, repeated visit corrections, changed date/source/type/condition/notes, incomplete-condition validation, NHG fixed dates, face correction interoperability, ordinary navigation reset, retained face/photo drafts, no early writes, final save and phone layout. No API or database changes are needed.
