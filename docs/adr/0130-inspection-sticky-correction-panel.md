---
---

# ADR 0130: Keep Required Corrections Accessible While Scrolling

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0129

## Decision

Keep the correction panel sticky at the bottom of the inspection editor's scroll area. Preserve its current-item status and live count. Place remaining issues in a native disclosure, collapsed initially, so the panel leaves room for editing on phones. Bound the expanded list height and allow it to scroll independently for inspections with many faces.

Close the disclosure before direct or directional issue navigation, then reuse existing field focus and draft-preserving navigation. Keep the panel within the inspection editor rather than fixing it over unrelated screens. Review, cancellation and saving retain existing behavior. No API or data-model changes are needed.

## Validation

Run lint, production build and focused required-information browser regressions. Desktop and phone checks verify the panel remains in place during actual detail-panel scrolling, list activation and collapse, focus, issue completion, retained draft evidence and final save. Inspect phone screenshots for field and panel visibility.
