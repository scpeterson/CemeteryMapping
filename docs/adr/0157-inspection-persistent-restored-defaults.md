---
---

# ADR 0157: Persist Restored Defaults Disclosure Visibility

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0156

## Decision

Initialize restoredDefaultsOpen from browser-local key cemetery-mapping:inspection-restored-defaults-open, defaulting closed when absent or invalid. Persist explicit summary activation through a guarded writer. Keep either choice across inspections and page reloads in the same browser/origin, retaining session behavior if storage access fails.

This preference controls only how reset results are displayed. Preserve its existing independence from the settings being restored, confirmation timing, focus behavior and inspection drafts. No server or draft persistence changes are introduced.

## Validation

Run lint, build and desktop/phone browser regressions. Verify open and closed choices across new inspections and actual reloads, retained source through explicit save, fallback when storage reads/writes throw, and existing reset/dismiss/timeout and draft-evidence behavior.
