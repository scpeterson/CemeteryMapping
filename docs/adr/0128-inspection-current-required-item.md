---
---

# ADR 0128: Identify The Current Required Correction

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0126 and ADR 0127

## Decision

Replace the count-only correction footer with a named Current required item panel. Identify the guided visit field or numbered face label and show its one-based position among the current unresolved items. Share the same current key as Previous/Next navigation, including active face changes and stable face IDs.

When a target is resolved, mark it complete and show the remaining count without assigning it an unresolved-item ordinal. Keep the existing all-complete message and Return to review behavior. Generic review editing before guidance starts prompts users to choose an item with Previous or Next. Current-item text announces politely, and both navigation controls reference the label and position/count. Derive this display without changing draft data, focus or navigation ordering.

## Validation

Run `npm run lint`, `npm run build` and `npm run test:inspections:browser -- record-photos.spec.ts -g "Previous and Next"`. Browser coverage checks item labels and ordinal positions in both directions, wraparound and shrinking lists, resolved/renamed faces, one remaining item, completion, accessible descriptions, retained draft evidence and final save, and phone layout. No API or database changes are needed.
