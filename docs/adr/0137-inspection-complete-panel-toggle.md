---
---

# ADR 0137: Hide The Remaining-Items Toggle At Completion

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0136

## Decision

Render Show/Hide remaining items only while required issues remain. At completion, let the status use the full header width and keep Return to review visible. Keep the existing collapsed choice in local state so reintroducing an issue restores the same panel mode. Derive visibility from existing validation without changing focus, draft data or persistence.

## Validation

Run lint, build and focused correction browser regressions. Desktop and phone checks cover completing visit and face requirements, absent toggle in both panel modes, restored controls after reintroducing an issue, unchanged input focus, Return to the required summary and retained draft evidence through explicit save.
