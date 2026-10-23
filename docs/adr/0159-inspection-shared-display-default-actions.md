---
---

# ADR 0159: Share Display Default Definitions With Reset Behavior

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0158

## Decision

Define restoredDisplayDefaults once in the inspection component, with stable preference ID, label, default-open value and existing guarded apply callback for each setting. Reset iterates these entries, while both confirmation lists derive their text and counts from the same entries. Remove the separately maintained reset calls and confirmation strings.

Keep each callback responsible for its established UI state and browser persistence, including the difference between remembered remaining-item visibility and temporary phone collapse. Preserve draft protection, focus, confirmation lifetime and storage failure handling. No default values or user flows change.

## Validation

Run lint, build and desktop/phone reset browser regressions. Seed all four preferences to nondefault values, reset via keyboard and verify all stored defaults, collapsed confirmation details, list labels/count and unchanged draft data. Retain existing draft/photo save, timeout/dismissal and unavailable-storage checks.
