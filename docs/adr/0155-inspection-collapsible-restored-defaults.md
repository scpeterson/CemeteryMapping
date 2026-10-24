---
---

# ADR 0155: Collapse The Restored Display Defaults List

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0154

## Decision

Keep the reset status text and Dismiss action visible while placing the three restored settings in a native Restored defaults disclosure, closed initially. Give the disclosure full confirmation width on phones. Keep interactive help outside the live status region and separate from the keyboard-shortcut disclosure. Preserve the four-second timeout, Escape/focus behavior, preferences and inspection draft.

## Validation

Run lint, build and desktop/phone reset browser checks. Verify the default-hidden list, keyboard expansion/collapse, all three settings, retained toggle focus and live confirmation, plus existing dismissal, timeout, draft retention and save/reload checks. Inspect the compact phone layout.
