# Admin Workflow Roadmap

[Documentation Home](index.md)

This page records the first administrative editing workflows for Cemetery Mapping. It exists so API endpoints, UI screens, tests, and audit logging are built around cemetery operations instead of isolated table edits.

## Guiding Rules

- Admin workflows require authenticated `admin` access.
- Reader workflows remain read-only.
- Deletes are soft deletes and must create audit events.
- Creates and updates should create audit events before they are exposed in the UI.
- Spatial geometry edits should be handled carefully and should not be the first editing workflow unless the source data workflow is also defined.

## Workflow Priority

### 1. Headstone Condition Updates

First admin edit workflow.

Admins need to update the condition of a physical headstone after inspection. This is the safest first edit because the data is scoped to `headstones`, does not reshape cemetery geometry, and matches the current need to track condition.

Initial fields:

- `condition`
- `condition_notes`
- `last_inspected_at`
- `photo_url`

Expected API:

- `PATCH /api/headstones/:id`

Expected audit action:

- `update`

### 2. Burial Biographical Corrections

Second admin edit workflow.

Admins need to correct names and dates imported from the spreadsheet or later source documents.

Initial fields:

- `first_name`
- `last_name`
- `full_name`
- `birth_date`
- `death_date`
- `burial_date`
- `notes`

Expected API:

- `PATCH /api/burials/:id`

Expected audit action:

- `update`

### 3. Gravesite Status and Notes

Third admin edit workflow.

Admins need to adjust operational gravesite status without changing geometry.

Initial fields:

- `status`
- `name`
- `cost`

Expected API:

- `PATCH /api/grave-spaces/:id`

Expected audit action:

- `update`

### 4. Headstone-to-Burial Association Fixes

Fourth admin edit workflow.

Admins may need to correct which burials are listed on a physical headstone.

Expected API:

- `POST /api/headstones/:id/burials`
- `DELETE /api/headstones/:id/burials/:burialId`

Expected audit actions:

- `create`
- `soft_delete`
- `restore` if restoring a previously removed association

### 5. Geometry Edits and New Spatial Records

Defer until the spatial editing source of truth is decided.

Geometry editing has higher risk because existing data originates from an Esri File Geodatabase and the spreadsheet-derived gravesite boxes are placeholders. Before exposing geometry edits, decide whether edits happen in this application, ArcGIS Pro, or another GIS editing workflow.

## Explicitly Deferred

- Editing cemetery or section polygons in the web UI.
- Creating surveyed gravesite polygons.
- Bulk import approval screens.
- Owner/contact editing.
- Hard delete operations.

## Validation Expectations

Each workflow should include:

- API authorization tests showing `reader` is denied and `admin` is allowed.
- API behavior tests for validation errors and audit event creation.
- E2E coverage for the visible admin UI once the UI exists.
- Documentation updates in the relevant ADR.
