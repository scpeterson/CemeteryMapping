---
---

# ADR 0160: Share Startup Display Defaults With Reset Definitions

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0159

## Decision

Move displayPreferenceSettings to module scope with each setting's typed key, storage ID, label and default-open value. Initialize all four display states through readDisplayPreference, honoring valid saved boolean strings and using the shared default for missing, invalid or unavailable storage. Derive reset/confirmation entries by binding the same definitions to an exhaustive typed map of existing preference writers.

Remove separately encoded initial defaults and the special remaining-items reader. Reset behavior, confirmation labels/count and startup fallbacks now use one definition. Preserve current defaults, valid saved choices, temporary phone correction collapse, focus and inspection drafts. No server or draft persistence changes are introduced.

## Validation

Run lint, build and desktop/phone browser regressions. Cover absent and invalid startup storage, unavailable-storage session fallback, resetting all four saved nondefault values, confirmation/count consistency, timeout/dismissal and draft fields/photo evidence through explicit save.
