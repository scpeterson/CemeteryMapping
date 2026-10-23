---
---

# ADR 0133: Automatically Compact Required Corrections On Phones

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0132

## Decision

Collapse the correction panel when jumping to a required visit field or face on viewports at or below the existing 760px mobile breakpoint. Apply this to review-required actions, incomplete step shortcuts, direct issue selection and Previous/Next. Evaluate matchMedia at navigation time so resizing is respected without changing panel state during typing or resizing alone.

Use the existing collapse state before the field-focus effect runs. Keep current status/count and Show controls visible. Reopening remains a user action, and desktop jumps preserve the user's current panel choice. Ordinary editing without a required target retains its existing behavior. Never rebuild, clear or save the draft during these transitions.

## Validation

Run lint, build and focused required-information browser regressions. Desktop/phone tests verify step, review, list and directional jumps; keyboard selection; focused fields above the compact panel; reopening while typing; draft readings/designs/photos and explicit save. Inspect phone screenshots.
