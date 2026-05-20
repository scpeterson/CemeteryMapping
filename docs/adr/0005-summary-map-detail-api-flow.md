# ADR 0005: Load Summary Map Geometry Before Grave Details

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #6

## Context

The map needs enough geometry to render the cemetery, sections, and grave spaces quickly. Full grave detail records include owners, burials, ownership history, and notes, which are not needed until a user selects a grave.

## Decision

Use a summary-first API flow:

- `GET /api/cemetery-map` returns cemetery boundary, section geometry, and summary gravesite geometry.
- `GET /api/grave-spaces/:id` returns full detail for one selected grave.
- `GET /api/search` returns search matches with summary grave records.

The frontend requests detail only when a grave is selected.

## Rationale

This keeps the initial map payload smaller and makes the detail panel lazy-loaded. It also keeps the UI responsive as more burials, headstones, and records are added.

## Consequences

The UI needs loading and error states for selected grave details. Tests must verify that the detail endpoint is not called for every map feature on initial load.

Backend repository code must keep summary and detail response shapes separate.

## Rebuild Notes

Validate the API-backed UI:

```bash
APP_ENV=test npm run test:e2e
```

Manual API checks:

```bash
curl -s http://127.0.0.1:3001/api/cemetery-map
curl -s http://127.0.0.1:3001/api/grave-spaces/A-01-01
curl -s "http://127.0.0.1:3001/api/search?q=Garcia"
```

## Update Triggers

Update this ADR when map payload shape, detail loading behavior, grave selection behavior, or search response structure changes.
