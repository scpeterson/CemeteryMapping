---
---

# ADR 0163: Compact Marker Section Navigation

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0113

## Decision

Replace the wrapped five-link button grid with a single native Jump to section menu. Retain all five destinations, scoped to the marker instance, and reuse heading focus/scroll navigation. Keep a placeholder selection so the same destination can be chosen repeatedly. Use a single-row label/control layout with a 44px control target and readable phone text.

Keep section contents and editors mounted. Choosing a destination only changes scroll/focus and must preserve inspection drafts and queued photos; no data/API or save behavior changes are needed. The navigation landmark remains labeled for its marker.

## Validation

Run lint, build and marker-section browser regressions. Verify destinations in standalone/gravesite views, repeated selection and heading focus, pending inspection/photo preservation, phone navigation height and horizontal fit, focused source editing and reader permissions. Inspect phone screenshot.
