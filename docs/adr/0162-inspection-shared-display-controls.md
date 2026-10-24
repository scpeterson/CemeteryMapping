---
---

# ADR 0162: Drive Display Controls From Shared Settings

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0161

## Decision

Include controlLabel in displayPreferenceSettings and bind each shared definition to its current open state and existing guarded apply callback. Use these entries for the remaining-items toggle, main keyboard-help disclosure, reset-confirmation keyboard-help disclosure and restored-defaults disclosure in both confirmation locations. Continue deriving Reset behavior, confirmation rows and count from the same bound entries.

Use exhaustive typed maps for state and actions so adding a setting requires both bindings. For remaining items, bind the control to current visibility rather than saved preference; automatic phone/list collapse remains temporary. Keep the existing focus request on explicit list expansion, native disclosure keyboard behavior, saved keys/defaults and draft protection.

## Validation

Run lint, build and focused desktop/phone browser regressions. Check control labels and keyboard interactions, correction focus and draft/photo retention, saved main/list choices across inspections/reloads, transient phone collapse, all four reset values and unavailable-storage fallback.
