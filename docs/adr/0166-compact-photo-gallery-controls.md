# ADR 0166: Compact photo gallery controls

- Date: 2026-10-23
- Extends: ADR 0112

## Decision

Keep the record selector visible in a compact toolbar. Put face and maintenance timing filters in a native disclosure with an active-filter count. Open the disclosure initially when entering a gallery scoped to a face; collapsing it preserves selections. Keep add/link action buttons visible, revealing instructions and editing fields only in the selected action mode. Remove the redundant header destination line because the record selector already identifies the scope.

Preserve photo selections, upload retries, permission checks, and draft guards. Use responsive filter columns and retain keyboard-accessible native controls.

## Validation

Run lint, production build, and photo gallery browser regressions. Verify the initial phone gallery places photos above the fold, optional filters preserve values while hidden, active counts update, face-scoped entry reveals its filter, and upload/link controls remain usable.
