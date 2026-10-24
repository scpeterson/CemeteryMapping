---
---

# ADR 0143: Remember Keyboard Help Across Inspection Navigation

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0142

## Decision

Store the keyboard-help open preference in the mounted inspection workflow component and synchronize the native details disclosure through open/onToggle. Keep the preference separate from draft data and correction-panel collapse state. Recreate help with the same preference after Review & save or another correction temporarily unmounts it. Start closed; retain either open or closed choice throughout navigation without changing focus or saving the draft.

## Validation

Run lint, build and the desktop/phone keyboard correction regressions. Verify open help survives Review & save and Next/Previous correction changes, closed help survives another review round trip, and all existing readings/designs/photos remain through explicit save.
