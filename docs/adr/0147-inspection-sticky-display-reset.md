---
---

# ADR 0147: Reset Display Preferences From The Sticky Correction Panel

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0146

## Decision

Place Reset display preferences and its status confirmation in the sticky correction panel, outside the collapsible issue list. Use the shared panel-visibility condition to render Reset in the ordinary workflow footer when the panel is absent, including Review & save. Render one Reset action and one status message at a time.

Reuse existing reset behavior, persisted defaults, draft-guard exemption and current correction state. Keep Reset reachable after required information becomes complete. No draft, API or navigation changes are needed.

## Validation

Run lint, build and desktop/phone correction regressions. Scroll the editor while the list is collapsed and verify sticky Reset remains fully visible; activate it via keyboard, retain focus, show confirmation within the panel, preserve draft readings/photos and save explicitly. Verify review availability, persisted defaults after reload and storage fallback.
