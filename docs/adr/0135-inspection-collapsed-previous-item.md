---
---

# ADR 0135: Move Backward From The Compact Correction Panel

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0134

## Decision

Place Previous missing item alongside Next in the collapsed panel using the existing two-column correction action layout. Render one directional pair for the active panel mode with the existing current-item accessible descriptions and touch target sizes. Keep Show controls available for the issue list and Return to review.

Both actions reuse moveMissingItem, preserving ordering, wraparound, resolved-item skipping, focused fields, phone auto-collapse and the draft. With one unresolved item either action refocuses it. Hide both when validation is complete. No data or API changes are needed.

## Validation

Run lint, build and focused correction browser regressions. Desktop/phone checks cover compact Previous keyboard activation and repeated backward navigation without reopening, wraparound, resolved-item skipping, one remaining item, completion, field visibility and retained draft evidence through explicit save. Inspect phone layout.
