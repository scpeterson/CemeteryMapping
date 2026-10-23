---
---

# ADR 0136: Return To Review From The Compact Panel

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0135

## Decision

Keep Return to review visible in the collapsed correction panel, including after the last required issue is resolved. Place the shared action group outside the collapsible issue-list body rather than rendering separate expanded and compact actions. Previous/Next retain their existing unresolved-item guard; Return remains available while the correction panel is present.

Reuse advanceStep and its existing focus destinations. Guided required corrections return to the Required information summary, while ordinary review edits preserve their established return destination. No navigation action saves, clears or rebuilds the draft. Collapsing still reduces the panel by hiding the remaining-issues disclosure.

## Validation

Run lint, build and focused required-information browser regressions. Desktop/phone checks cover collapsed Return via keyboard with unresolved issues, completed Return without expanding, focused review summary, preserved visit values and existing draft readings/designs/photos through explicit save. Inspect phone layout.
