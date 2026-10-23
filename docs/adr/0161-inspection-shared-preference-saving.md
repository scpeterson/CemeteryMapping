---
---

# ADR 0161: Save Display Preferences Through Shared Settings Definitions

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0160

## Decision

Use displayPreferenceSetting for typed definition lookup and saveDisplayPreference for every persisted display choice. Resolve storage IDs from the shared settings list and keep guarded writes in one place. All four existing preference callbacks still update their UI state before calling this helper, retaining in-session behavior when storage is unavailable.

Startup reads, explicit saves, Reset actions, confirmation labels and counts now share the same setting identity and metadata. Preserve stored key names/defaults, explicit-versus-temporary phone collapse, focus, confirmation timing and inspection drafts. No server or draft persistence changes are introduced.

## Validation

Run lint, build and focused desktop/phone browser regressions. Verify keyboard-help and remaining-items choices across inspections/reloads, phone correction collapse without overwriting remembered choices, reset from all four nondefault saved values, blocked-storage fallback and retained draft/photo evidence through explicit save.
