---
---

# ADR 0146: Reset Inspection Display Preferences Without Discarding Drafts

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0145

## Decision

Add Reset display preferences to the inspection workflow footer, available during editing and Review & save. Restore remaining items shown and keyboard help closed through the existing guarded preference writers. Apply defaults immediately and persist them for future inspections/reloads; retain in-session behavior if storage is unavailable. Provide a status confirmation without moving focus from Reset or changing correction identity or draft data.

Exempt only the inspection editor's specific display-reset button from the generic Reset-name draft-discard guard. Preserve all other navigation/reset protection. Automatic phone correction collapse continues after subsequent jumps, without overwriting the restored preference.

## Validation

Run lint, build and desktop/phone browser regressions. Change both preferences on a dirty draft, activate Reset via keyboard and on review, verify no discard dialog or persistence occurs, retain source/readings/queued photo notes through explicit save, and verify defaults after reload. Existing correction and storage-fallback checks remain in scope.
