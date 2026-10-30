---
---

# ADR 0185: Filter map statuses without replacing geometry

- Date: 2026-10-30
- Status: Accepted

## Decision

Keep all cemetery-scoped grave geometry in its source. Apply selected statuses
as filters to grave fills, outlines, labels and veteran symbols. Keep the marker
source's veteran association stable and filter its veteran-star layer to visible
veteran grave keys. Marker circles and other marker layers remain selectable when
their associated grave is hidden, matching prior behavior. Cemetery scope and
record changes still update sources; status toggles do not. Stable feature IDs
retain search and selection state while a feature is hidden and shown again.

## Validation and recovery

Run `npx tsc -b`, `npm run lint`, and the map-status-filter, map-highlighting,
status-colors and search-pagination Playwright specs. Actual MapLibre source
instrumentation measured two status toggles submitting grave geometry twice and
marker geometry twice before this change, versus zero submissions to either
source afterward. This measures removed source work, not end-to-end latency.
Browser checks cover rendered visibility, all affected layer filters, veteran-star
filtering, retained selection state and marker selectability. Revert the map
prop/source/filter changes to restore geometry-based filtering. No migration is
required.
