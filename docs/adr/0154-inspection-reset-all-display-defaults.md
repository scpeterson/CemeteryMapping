---
---

# ADR 0154: Include Reset Confirmation Help In Display Defaults

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0153
- Supersedes: The reset exclusion for confirmation-help preference in ADR 0152 and ADR 0153

## Decision

Reset display preferences now restores all three established display defaults: remaining items shown, main keyboard help closed and reset-confirmation keyboard help closed. Use rememberResetKeyboardHelp(false) so the confirmation preference is persisted through the same guarded writer as explicit user choices. Confirm that both keyboard hints are hidden.

After Reset, users may reopen confirmation help normally; later Reset actions close it again. Keep timer, Dismiss/Escape, focus restoration, phone auto-collapse and the scoped draft-discard exemption unchanged. No draft data or server state is modified.

## Validation

Run lint, build and desktop/phone reset/default browser regressions. Open confirmation help then Reset on review and in the sticky panel, verify closed defaults across new inspections/reloads and unavailable storage, and retain draft fields/photos through explicit save. Preserve timeout and dismissal behavior.
