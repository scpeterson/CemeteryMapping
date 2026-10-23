---
---

# ADR 0141: Return To The Current Correction With Escape

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0140

## Decision

Handle unmodified Escape within the remaining-items list to hide it and focus the current correction field after the collapse commits. Use the existing current correction key and active face rather than the list button being browsed. A just-completed current field remains the return destination. For ordinary review edits without a guided field, use the selected face label or visit editor entry field.

Reuse existing pending field refs and focus-request revision without changing correction identity, step or draft. Consume the Escape event within the list; leave other contexts and modified keys untouched. Correction actions remain visible, and Show remaining items can reopen the list with its established focus behavior.

## Validation

Run lint, build and focused desktop/phone correction browser regressions. Browse to a different issue then Escape back to the current visit field or face; repeat for a completed current field. Check collapsed state, current identity, retained field values, reopening and retained readings/designs/photos through explicit save.
