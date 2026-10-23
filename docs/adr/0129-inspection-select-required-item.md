---
---

# ADR 0129: Select Any Remaining Required Item

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0128

## Decision

Show a numbered list of live unresolved visit fields and face labels in the correction panel. Each item is a native button that jumps directly to its field, including reselection of the current issue. Indicate the current item with text, styling and aria-current. Remove resolved items immediately; hide the list when none remain.

Direct selection and Previous/Next share the same navigation helper and existing draft, stable face IDs, focus requests and Return to review behavior. No saving or uploading occurs during navigation. Keep current-item announcements separate from the list to avoid announcing the whole list on every edit.

## Validation

Run lint, production build and the focused required-information browser regressions. Desktop and phone coverage checks arbitrary selection, keyboard activation, current selection, same-item focus, live removal, retained readings/designs/photos and final save alongside Previous/Next navigation.
