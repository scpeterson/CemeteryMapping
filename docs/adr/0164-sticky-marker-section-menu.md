---
---

# ADR 0164: Keep The Marker Section Menu Accessible While Scrolling

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0163

## Decision

Make the compact Jump to section menu sticky within its marker article, below the detail tabs. Observe the tab and menu sizes to derive marker-scoped sticky and scroll-margin CSS properties, accommodating wrapped tabs in gravesite and phone views. Keep the menu below tabs in stacking order and above content.

Use the same measured offset for destination headings and the inspection required-information summary so focused targets remain below the sticky navigation. Disconnect the observer when editing replaces the marker article or the component unmounts. Preserve section selection, repeated jumps, mounted editors, pending inspection/photo drafts and native select keyboard behavior.

## Validation

Run lint, build and marker-section browser regressions. Verify menu visibility and position during actual scrolling, no overlap with tabs or focused section headings, all destinations, standalone/gravesite and desktop/phone layouts, existing draft/photo preservation, editing focus and reader permissions. Inspect phone screenshots.
