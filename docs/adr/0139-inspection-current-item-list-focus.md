---
---

# ADR 0139: Focus The Current Issue When Revealing Remaining Items

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0138

## Decision

When the user explicitly chooses Show remaining items, target the current unresolved issue by its stable key. If it has been resolved or no guided target exists, use the first remaining issue. After expansion commits, scroll the target into view and focus its native list button without an extra focus-induced scroll.

Register list buttons by stable visit-field/face keys and consume a pending focus request only on expansion. Do not move focus on draft changes, validation updates or ordinary rendering. Hiding retains toggle focus, and choosing an issue retains existing field navigation and draft preservation. Completed panels continue omitting the toggle.

## Validation

Run lint, build and focused desktop/phone correction browser regressions. Check keyboard expansion, current-item focus including later items beyond the scroll window, full visibility within the list, resolved-target fallback, selected-field navigation and retained draft evidence through explicit save.
