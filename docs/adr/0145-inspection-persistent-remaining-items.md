---
---

# ADR 0145: Persist Remaining-Items Visibility Without Disabling Phone Collapse

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0144

## Decision

Persist explicit Show/Hide remaining items choices under browser-local key cemetery-mapping:inspection-remaining-items-open. Escape is an explicit hide choice. Initialize visibility from this preference on mount and restore it when beginning another inspection. Default open when no preference exists; catch storage failures and preserve the in-session preference.

Keep saved preference separate from current correctionCollapsed state. Automatic phone jumps and list-selection collapse affect current visibility only, preserving the user's preference for subsequent inspections/reloads. Required-item jumps on phones still collapse before focusing the field. Keep draft state, keyboard-help preference, live validation, completion and Return behavior independent.

## Validation

Run lint, build and focused desktop/phone browser regressions. Verify open and closed choices across inspections and real reloads, phone correction collapse without overwriting the saved choice, source values through explicit save, storage-failure fallback and existing draft evidence/keyboard corrections.
