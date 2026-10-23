---
---

# ADR 0127: Navigate Required Corrections In Both Directions

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0126

## Decision

Offer Previous missing item beside Next missing item during required-information corrections. Share one direction-aware navigation handler and the live missing-item list. Previous visits earlier unresolved targets in reverse date/source/condition/face order, skips resolved items, and wraps to the last outstanding issue. Next retains its established forward behavior. A single outstanding target is focused again by either action.

Both controls reference the same accessible remaining count, preserve exact-field post-commit focus and stable face IDs, and disappear when requirements are complete. Return to review and ordinary Back retain their existing behavior. No draft values or photo queues are replaced, and navigation performs no writes.

## Validation

Run `npm run lint`, `npm run build` and the focused browser checks with `npm run test:inspections:browser -- record-photos.spec.ts -g "Previous and Next"`. Browser coverage checks keyboard activation, reverse same-stage/cross-stage focus, wraparound, skipping resolved fields and renamed faces, one remaining item, completion, retained reading/design/file/library drafts, final save and phone layout. No API or database changes are needed.
