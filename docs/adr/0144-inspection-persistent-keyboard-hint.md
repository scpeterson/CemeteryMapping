---
---

# ADR 0144: Persist The Keyboard-Hint Preference In This Browser

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0143

## Decision

Initialize the keyboard-help preference from localStorage key cemetery-mapping:inspection-keyboard-help-open. Persist explicit summary activation as boolean strings while controlling the native disclosure's open property. Prevent native default toggling so mount/unmount toggle events cannot overwrite the saved choice. The preference applies across inspections and page reloads in the same browser/origin; absent or invalid values default closed.

Catch storage access and write failures, retaining the component's in-session preference when persistence is unavailable. Keep this UI preference separate from inspection draft data and existing draft navigation protection. No server, account, or draft persistence is introduced.

## Validation

Run lint, build and focused desktop/phone browser regressions. Verify both open and closed choices across new inspections and actual page reloads, retained source values through explicit save, correction/review navigation with draft evidence, and usable session-only behavior when storage reads and writes throw.
