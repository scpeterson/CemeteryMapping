---
---

# ADR 0158: Include Restored Defaults Visibility In Display Reset

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0157
- Supersedes: The reset exclusion for restored-list visibility in ADR 0156 and ADR 0157

## Decision

Reset display preferences also calls rememberRestoredDefaults(false), closing the restored-defaults list immediately and persisting its default. The restored list now describes all four settings: remaining items shown, main keyboard hint hidden, reset-confirmation keyboard hint hidden and restored-defaults list hidden.

Users may reopen the list afterward; another Reset closes it again. Preserve existing focus, confirmation timing, Dismiss/Escape, phone correction collapse, storage-failure fallback and draft protection. No inspection or server data changes are introduced.

## Validation

Run lint, build and desktop/phone reset/default browser regressions. Open the list then Reset in the sticky panel and Review & save, verify its stored closed value and defaults across inspections/reloads, cover unavailable storage, and retain draft fields/photo evidence through explicit save.
