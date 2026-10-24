---
---

# ADR 0151: Collapse Reset Confirmation Keyboard Help

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0150

## Decision

Place reset-confirmation shortcuts in a native Keyboard shortcuts disclosure, closed initially. Keep confirmation text and Dismiss visible. Preserve the full shortcut list as Dismiss's accessible description even when the visual help is closed. Do not change reset defaults, draft state, Escape handling or the four-second confirmation lifetime.

## Validation

Run lint, build and desktop/phone reset browser checks. Verify initial hidden help, keyboard open/close with toggle focus preserved, unchanged live confirmation and accessible description, Escape from expanded help on review, automatic timeout, draft evidence and explicit save. Inspect phone layout.
