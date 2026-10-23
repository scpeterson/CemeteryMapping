---
---

# ADR 0165: Show The Current Marker Section While Scrolling

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0164
- Supersedes: The placeholder-only menu value in ADR 0163

## Decision

Bind Jump to section to currentSection rather than a placeholder. Track the last marker section whose top has reached a reading line 64px below the sticky menu, allowing for heading spacing and small layout shifts, falling back to Inspections above the sections. At the scroll container's end, recognize the last section if it is visible even when its heading cannot reach that line.

Listen to the containing detail panel's scroll events and schedule measurement once per animation frame. Recompute with existing resize observation, including marker content size changes. Scope sections to the current marker article; clean up listeners, observers and frames when editing replaces it or it unmounts.

Scroll tracking updates selection only and never scrolls or focuses content. Explicit menu changes retain heading navigation. Preserve native keyboard access and all mounted drafts/photo selections.

## Validation

Run lint, build and marker-section browser regressions. Verify explicit jumps update menu value, manual forward/backward scrolling tracks every section without moving focus, end-of-panel handling, sticky menu/heading geometry, standalone/gravesite desktop/phone layouts, and existing draft/photo preservation and reader/editor behavior.
