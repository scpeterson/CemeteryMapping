---
---

# ADR 0140: Browse Remaining Corrections With Arrow Keys

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0139

## Decision

Support ArrowUp and ArrowDown on the native remaining-item buttons, wrapping through the live unresolved list. Home and End focus its first and last entries. Scroll focused entries into view and preserve ordinary Tab navigation. Expose navigation shortcuts through aria-keyshortcuts; leave modified key combinations and other keys untouched.

Arrow navigation only changes focus. Enter and Space retain native button activation to select the correction through the existing draft-preserving handler. Current-item indication changes only on selection. Derive target indices from current validation so resolved issues are skipped and a sole remaining item retains focus.

## Validation

Run lint, build and focused desktop/phone correction browser regressions. Cover both arrows, wraparound, Home/End, later-item visibility, Enter selection, unchanged current correction while browsing, shrinking lists, one remaining item and retained readings/designs/photos through explicit save.
