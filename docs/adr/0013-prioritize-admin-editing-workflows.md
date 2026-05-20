# ADR 0013: Prioritize Admin Editing Workflows

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: Admin workflow decision phase

## Context

The application now has a security foundation, application roles, soft-delete support, audit events, and admin-only grave-space soft delete and restore endpoints. Create and update endpoints need product decisions before implementation so the API and UI reflect real cemetery workflows.

The current data model includes cemetery geometry, sections, generated gravesite rectangles, headstone markers, burials, owners, and memorials. Real spatial geometry also has external source-of-truth concerns because cemetery and section data originated from an Esri File Geodatabase.

## Decision

Expose admin editing workflows in this order:

1. Headstone condition updates.
2. Burial biographical corrections.
3. Gravesite status and notes.
4. Headstone-to-burial association fixes.
5. Geometry edits and new spatial records only after deciding the spatial source of truth.

Create/update endpoint implementation should start with headstone condition updates.

## Rationale

Headstone condition updates are the safest first workflow because they are important, scoped, and do not affect spatial topology. Burial corrections are next because imported spreadsheet data may need cleanup, but edits should be carefully audited. Gravesite status changes are operationally useful and avoid geometry changes. Association fixes are useful but need clear UI affordances to avoid confusing a headstone, burial, and gravesite relationship.

Geometry edits should wait because the project has already identified a likely future topology need, and current gravesite polygons generated from GPS points are placeholders.

## Consequences

The next code phase should implement:

- Admin-only `PATCH /api/headstones/:id`.
- Validation for allowed condition values and date fields.
- Audit event creation for headstone updates.
- Tests proving `reader` cannot update and `admin` can update.
- Documentation updates for the API and ADR.

The admin UI should then expose a focused headstone condition editing surface, not a general table editor.

## Rebuild Notes

The workflow roadmap is documented in [Admin Workflow Roadmap](../admin-workflows.md).

Validation commands after the first implementation:

```bash
npm ci
APP_ENV=test npm run db:migrate
npm run test:server
npm run lint
npm run build:test
APP_ENV=test npm run test:e2e
```

## Update Triggers

Update this ADR if the workflow order changes, if geometry editing moves earlier, if owner/contact editing becomes urgent, or if a new source system changes which application records should be edited directly.
