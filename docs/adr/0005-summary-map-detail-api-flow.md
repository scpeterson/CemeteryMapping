---
---

# ADR 0005: Load Summary Map Geometry Before Grave Details

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #6

## Context

The map needs enough geometry to render the cemetery, sections, and grave spaces quickly. Full grave detail records include owners, burials, ownership history, and notes, which are not needed until a user selects a grave.

## Decision

Use a summary-first API flow:

- `GET /api/cemetery-map` returns all active cemetery boundaries, section geometry, and summary gravesite geometry.
- `GET /api/cemeteries/:cemeteryId/grave-spaces/:id` returns full detail for one selected grave using the cemetery-scoped gravesite identifier.
- `GET /api/search` returns search matches with summary grave records.

The frontend fits the map to the full active cemetery dataset on load, allows zooming out far enough to see geographically separated non-production demo and imported cemeteries, supports mouse-wheel zooming, exposes map zoom and fit controls, renders broad-zoom cemetery markers, shows fractional and segmented bar scale, provides a legend for rendered layers and gravesite statuses, and requests detail only when a grave is selected.

After an ordinary record mutation, the frontend updates the affected map summary and selected detail caches from the mutation response whenever the resulting state is locally deterministic. Marker creation and edits, burial edits, gravesite edits, feature and photo deletion, photo reordering, and lot assignment do not reload the full cemetery-map payload. Pure cache transitions live in `src/hooks/recordMutationState.ts` so their behavior can be tested independently of React.

The selected detail endpoint may still be requested when the server owns derived state that is not fully represented in the mutation response. Current examples include ownership changes, photo uploads that create server-side media-link identifiers, marker relationship changes, and marker edits that explicitly propagate North Hills inclusion to associated burials. These refreshes preserve the displayed record while the targeted request is in flight.

Gravesite labels are formatted from the populated hierarchy fields only. Trinity Lutheran Church Cemetery does not use blocks; its lots are scoped directly to sections. It uses lots in some sections and passageway or individually managed gravesites in others, so UI labels include the lot segment when `lot_id` is populated and omit block or lot segments when their identifiers are blank instead of rendering empty placeholders.

## Rationale

This keeps the initial map payload smaller and makes the detail panel lazy-loaded. Returning all active cemetery boundaries keeps the view usable when imported data includes more than one cemetery or when demo and migrated data temporarily exist in the same environment.

## Consequences

The UI needs loading and error states for selected grave details. Tests must verify that the detail endpoint is not called for every map feature on initial load.

Backend repository code must keep summary and detail response shapes separate. Summary map and search queries should include all active cemeteries so the visible map and search results describe the same dataset.

Mutation handlers must not use `GET /api/cemetery-map` as a general cache-invalidation mechanism. New mutations should return enough updated state for a local cache transition where practical, and should fall back to one targeted detail request only when the server derives related state.

## Rebuild Notes

Validate the API-backed UI:

```bash
APP_ENV=test npm run test:e2e
```

Manual API checks:

```bash
curl -s http://127.0.0.1:3001/api/cemetery-map
curl -s http://127.0.0.1:3001/api/cemeteries/<cemetery-id>/grave-spaces/A-01-01
curl -s "http://127.0.0.1:3001/api/search?q=Garcia"
```

## Update Triggers

Update this ADR when map payload shape, detail loading or mutation-refresh behavior, grave selection behavior, map/search label formatting, or search response structure changes.
