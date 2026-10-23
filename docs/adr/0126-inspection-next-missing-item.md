---
---

# ADR 0126: Guide Corrections With Next Missing Item

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0123 and ADR 0125

## Decision

Offer Next missing item during required-information correction flows and review-origin editing when required items remain. Show an accessible remaining-item count. Derive all targets from existing validation; advance after the current target in date/source/condition/face order, wrapping to earlier unresolved items. Track faces by stable ID so renaming them does not disrupt guidance. Repeated activation with only the current issue outstanding refocuses it.

Use existing post-commit field/face focus requests and retain the entire mounted draft. Guidance also works when begun from an incomplete step before opening review. Return to review stays available and goes to Required information. Hide Next missing item when no issues remain and show completion in its place. Ordinary navigation clears guidance; regular review edits keep their existing return destination unless the user starts guided corrections. Navigation performs no writes and does not change validation rules.

## Validation

Run `npm run lint`, `npm run build` and `npm run test:inspections:browser`. Browser coverage checks keyboard use, same-stage and cross-stage focus, live remaining counts, skipping/wrapping unresolved fields, renamed faces, one remaining issue, completion and Return focus, retained reading/design/file/library drafts, final save and phone layout. No API or database changes are needed.
