---
---

# ADR 0134: Advance Required Corrections From The Compact Panel

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0133

## Decision

Keep Next missing item available below the current-item summary when the correction panel is collapsed and unresolved issues remain. Use the same directional handler and accessible current-item description as the expanded action; render a single Next button for the current mode. Keep Show controls available for the full list, Previous and Return.

Advancing on phones retains automatic collapse and field focus. Skip resolved issues, wrap remaining issues and refocus a sole outstanding item as before. Hide Next once all required items are complete. Panel navigation never saves or replaces the draft.

## Validation

Run lint, build and focused correction browser regressions. Desktop/phone coverage checks visible compact Next, keyboard activation, repeated navigation without reopening, wraparound, skipping completed fields, the final remaining item, completion, field visibility and retained draft evidence through explicit save.
