---
---

# ADR 0153: Persist Reset Confirmation Shortcut Visibility

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0152

## Decision

Persist explicit reset-confirmation shortcut open/closed choices in browser-local key cemetery-mapping:inspection-reset-keyboard-help-open. Initialize the existing state lazily, defaulting closed for absent/invalid values. Guard storage reads/writes so unavailable storage retains in-session behavior. Keep this preference separate from draft data, main keyboard help and remaining-item visibility.

Reset display preferences retains its established main-list/main-help defaults and does not overwrite this independently chosen confirmation-help preference. Confirmation timeout, dismissal, review transitions and new inspections preserve it; no server or draft persistence changes are introduced.

## Validation

Run lint, build and desktop/phone browser regressions. Verify both choices across new inspections and actual reloads, retained source through explicit save, session fallback when storage throws, and existing reset/dismiss/timeout and draft-evidence behavior.
