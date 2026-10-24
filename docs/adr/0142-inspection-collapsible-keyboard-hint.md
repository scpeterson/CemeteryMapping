---
---

# ADR 0142: Collapse Keyboard Help Beside Remaining Items

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0141

## Decision

Place the keyboard shortcut list in a native details disclosure labeled Keyboard shortcuts, closed initially. Keep it independent from remaining-item visibility, correction navigation and draft state. Preserve its open state while the containing panel is hidden and reopened. Retain the full hint as the issue list’s accessible description even when the visual hint is closed.

## Validation

Run lint, build and existing desktop/phone keyboard correction browser checks, including initial hidden help, keyboard expansion/collapse, retained toggle focus, accessible description and draft evidence through explicit save. Inspect the phone layout.
