---
---

# ADR 0138: Reveal Remaining Corrections Directly

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0137

## Decision

Remove the nested remaining-items disclosure. Show remaining items reveals the selectable issue list directly; Hide remaining items hides it. Keep the list height bounded with internal scrolling and preserve the always-visible correction actions.

Selecting a list item collapses the list on both desktop and phone, replacing the old nested-disclosure close behavior and leaving room for the focused field. Reuse existing issue navigation and draft state. Directional and review navigation retain their existing behavior. Remove the obsolete details ref and styling.

## Validation

Run lint, build and focused desktop/phone correction browser regressions. Verify single-action list access, keyboard selection, selection collapse, focus, sticky actions, completion and retained draft evidence through explicit save. Inspect expanded phone layout.
