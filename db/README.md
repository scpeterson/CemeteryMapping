# Database

This project uses Liquibase to manage a PostgreSQL/PostGIS schema for cemetery GIS and records data.

## Local database

Database commands default to `DEV`. Use `APP_ENV=dev|test|stage|prod` to target a specific environment.

Environment database settings live in:

```text
db/env/dev.env
db/env/test.env
db/env/stage.env
db/env/prod.env
```

Each environment can also have a local, gitignored override file named `db/env/<environment>.local.env`.
Use this for machine-specific settings such as a different DEV host port when another local PostgreSQL service already uses `5432`.

Local Docker ports:

```text
DEV:   localhost:5432 / cemetery_mapping_dev
TEST:  localhost:5433 / cemetery_mapping_test
STAGE: localhost:5434 / cemetery_mapping_stage
PROD:  localhost:5435 / cemetery_mapping_prod
```

For example, this local override keeps the DEV Docker database off a host PostgreSQL install on `5432`:

```text
# db/env/dev.local.env
POSTGRES_PORT=5436
```

The checked-in PROD file is for local/prototype infrastructure only. Real production deployments should inject database credentials through deployment secrets, not commit them to the repository.

Start Postgres/PostGIS for DEV:

```bash
npm run db:up
```

Start another environment:

```bash
npm run db:up:test
npm run db:up:stage
npm run db:up:prod
```

Apply migrations:

```bash
npm run db:migrate
APP_ENV=test npm run db:migrate
```

Check migration status:

```bash
npm run db:status
APP_ENV=stage npm run db:status
```

Roll back the latest changeset:

```bash
npm run db:rollback
```

Roll back more than one changeset:

```bash
npm run db:rollback -- 2
```

Create a rollback target tag:

```bash
npm run db:tag -- before-owner-import
```

Roll back to a tag:

```bash
npm run db:rollback:tag -- before-owner-import
```

Test that pending migrations can be applied, rolled back, and applied again:

```bash
npm run db:rollback:test
```

Validate the changelog without applying it:

```bash
npm run db:validate
```

Validate spatial data and topology-like rules:

```bash
npm run db:validate:spatial
APP_ENV=test npm run db:validate:spatial
```

Spatial validation reads the `spatial_validation_issues` view and exits non-zero if any `error` rows are found. The current checks cover invalid geometry, parent/child containment, overlapping grave polygons, and basic geometry-type expectations for staged imports.

Containment checks use severity so small boundary slivers can be reviewed without blocking promotion. Geometry that extends more than 1 square meter outside its parent is an `error`; smaller non-zero differences are a `warning`.

Generated `TLC-GPS-*` gravesite rectangles from the headstone spreadsheet are treated as approximate placeholder grave polygons until surveyed grave polygons are available. Overlaps among those generated rectangles are reported as `warning` rows by `npm run db:validate:spatial` rather than blocking errors.

Load demo data into DEV/TEST/STAGE:

```bash
npm run db:seed:demo
APP_ENV=test npm run db:seed:demo
APP_ENV=stage npm run db:seed:demo
```

The demo seed command refuses to run when `APP_ENV=prod`.
The demo fixture now seeds section-scoped lots and links demo gravesites through `lot_uuid` so the map and API exercise the cemetery/section/lot/gravesite hierarchy. Blocks remain empty because they are still optional.

Stop the local database:

```bash
npm run db:down
APP_ENV=prod npm run db:down
```

## Connection

The local DEV Docker database uses:

```text
host: localhost
port: 5432
database: cemetery_mapping_dev
user: cemetery_app
password: cemetery_app_dev
```

If `db/env/dev.local.env` sets `POSTGRES_PORT`, use that port instead. On this machine DEV is configured to use `5436`.

The local TEST Docker database uses:

```text
host: localhost
port: 5433
database: cemetery_mapping_test
user: cemetery_app
password: cemetery_app_test
```

This project does not use Docker Compose profiles for environments. Do not use `docker compose --profile test ...` for TEST commands; it will not target the running TEST project.

The npm wrappers translate `APP_ENV=test` into:

```text
-p cemeterymapping-test --env-file db/env/test.env
```

When `db/env/<environment>.local.env` exists, the wrappers pass it to Docker Compose after the checked-in env file so local values override the shared defaults.

Connect to TEST with `psql` through Docker Compose:

```bash
docker compose \
  -p cemeterymapping-test \
  --env-file db/env/test.env \
  exec db psql \
  -U cemetery_app \
  -d cemetery_mapping_test
```

Or connect directly to the running container:

```bash
docker exec -it cemetery-mapping-db-test psql \
  -U cemetery_app \
  -d cemetery_mapping_test
```

Check the TEST compose project:

```bash
docker compose \
  -p cemeterymapping-test \
  --env-file db/env/test.env \
  ps
```

## Changelog layout

```text
db/changelog/db.changelog-root.yaml
db/changelog/changes/001-initial-schema.sql
db/changelog/changes/002-esri-cemetery-template-schema.sql
db/changelog/changes/003-spatial-import-staging.sql
db/changelog/changes/004-spatial-validation-severity.sql
db/changelog/changes/005-headstones.sql
db/changelog/changes/006-security-rbac-soft-delete-audit.sql
db/changelog/changes/007-cemetery-scoped-gravesite-identifiers.sql
db/changelog/changes/008-correct-north-hills-source-name.sql
db/changelog/changes/009-correct-north-hills-genealogists-spelling.sql
db/changelog/changes/010-lot-support.sql
db/changelog/changes/011-power-user-role.sql
db/changelog/changes/012-section-alternate-names.sql
db/changelog/changes/013-section-primary-key-name.sql
db/changelog/changes/014-database-audit-triggers.sql
db/changelog/changes/015-updated-at-triggers.sql
```

The current schema follows the same logical structure as Esri's Cemetery Management solution template, but uses PostgreSQL/PostGIS naming and omits ArcGIS-managed fields such as `OBJECTID`, `GlobalID`, editor tracking fields, shape area/length fields, and relationship `parentglobalid` fields.

The schema creates:

- `cemeteries`
- `sections`
- `blocks`
- `lots`
- `gravesites`
- `burials`
- `owners`
- `headstones`
- `headstone_burials`
- `app_roles`
- `app_users`
- `audit_events`
- `memorials`
- `spatial_import_batches`
- `spatial_import_features`

The spatial columns are:

- `cemeteries.geometry geometry(MultiPolygon, 4326)`
- `sections.geometry geometry(MultiPolygon, 4326)`
- `blocks.geometry geometry(MultiPolygon, 4326)`
- `lots.geometry geometry(MultiPolygon, 4326)`
- `gravesites.geometry geometry(MultiPolygon, 4326)`
- `headstones.geometry geometry(Point, 4326)`
- `memorials.geometry geometry(Point, 4326)`
- `spatial_import_features.geometry geometry(Geometry, 4326)`

Hierarchical GIS identifiers mirror the template fields using snake_case names:

- `facility_id`
- `block_id`
- `lot_id`
- `grave_id`
- `gravesite_id`

The `sections` table now uses `section_id uuid` as its primary key. Imported section labels such as `B` or `D` live in `sections.name`; sections do not retain a separate source `section_id` text column. Downstream lot and gravesite rows still keep source hierarchy text such as `section_id`, `lot_id`, and `grave_id` for import correlation and human-readable grave identifiers, while `section_uuid` and related UUID fields preserve relational links.

Sections also include `alternate_names text[]` for locally used names that differ from the primary section label. The current migrations backfill active sections `B` and `D` with `OC` and `Original Cemetery`, and active sections `A` and `C` with `NA` and `New Annex`. Sections also include `notes varchar(4000)` for administrative context. Section geometry is nullable so known sections can be recorded before surveyed spatial boundaries are available; map queries only render sections that already have geometry. Admin users can edit these aliases and notes from the Admin UI Cemetery Records tab.

## Security schema

The security foundation uses:

- `app_roles` for application roles. Initial values are `reader`, `power-user`, and `admin`.
- `app_users` for identity-provider subjects mapped to application roles.
- `audit_events` for append-only row-level change history.
- `deleted_at`, `deleted_by`, and `delete_reason` columns on cemetery business tables.

The application should use soft deletes for cemetery data. Normal read queries should filter `deleted_at IS NULL`; administrative recovery and audit views can explicitly include deleted rows.

Database triggers write `audit_events` records for inserts, updates, soft deletes, restores, and hard deletes across the core cemetery and admin tables. API mutation paths set transaction-local audit context so audit rows include the application user, role, identity-provider subject, and email. Direct database changes are also captured with PostgreSQL `current_user` and `session_user`; use unique named database login roles for every person or automation with direct database access. See the [Database Auditing](../docs/database-auditing.md) guide.

Database triggers also maintain `updated_at` on current tables that expose that lifecycle column. Application code should not set `updated_at` manually for normal row updates.

Current API authorization modes:

- `AUTH_MODE=disabled`: development/test default. Requests are treated as a local admin.
- `AUTH_MODE=trusted-header`: controlled integration mode. A trusted proxy must provide `x-cemetery-user-subject`, `x-cemetery-user-email`, and `x-cemetery-user-role`.
- `AUTH_MODE=auth0`: production mode. The API validates Auth0 JWT bearer tokens and loads the local `app_users` record by `external_subject`.

Trusted-header mode is not a production identity-provider replacement.

For Auth0 users, `app_users.external_subject` must match the token `sub` claim, `app_users.role_name` must be `reader`, `power-user`, or `admin`, and `app_users.is_active` must be `true`. Deactivating a user sets `is_active` to `false`, blocking application access without deleting the Auth0 account or local mapping.

## Spatial import staging

Real GIS imports should land in staging before production tables:

- `spatial_import_batches` records the source file/export, source format, source SRID, importer, and notes.
- `spatial_import_features` stores raw cemetery, section, block, lot, gravesite, and memorial features with source identifiers, original properties, and normalized 4326 geometry.
- `spatial_validation_issues` reports production and staging geometry issues before data is promoted.

The first staging model intentionally preserves source metadata as `jsonb`. Importers load into staging first, validation separates errors from warnings, and promotion refuses batches that still have staging errors.

## File Geodatabase workflow

The first real source format is expected to be an Esri File Geodatabase folder ending in `.gdb`. The local inspection/export commands require GDAL/OGR on your PATH.

Inspect available layers:

```bash
npm run geodatabase:inspect -- /path/to/cemetery.gdb
```

Export a layer to normalized GeoJSON in EPSG:4326:

```bash
npm run geodatabase:export -- /path/to/cemetery.gdb Gravesites /tmp/cemetery-import/gravesites.geojson
```

Import recognized Esri Cemetery Management layers into staging:

```bash
npm run db:import:geodatabase -- /path/to/cemetery.gdb --source-name "Cemetery Data Management"
```

The importer currently reads `Cemeteries`, `Sections`, `Blocks`, `Lots`, and `Memorials`, normalizes geometries to EPSG:4326, and preserves original File Geodatabase attributes in `spatial_import_features.source_properties`.

Use the inspection output to map Esri layer and field names to the staging hierarchy fields (`facility_id`, `section_id`, `block_id`, `lot_id`, `grave_id`, `gravesite_id`). After import, run:

```bash
npm run db:validate:spatial
```

Promote a validated staging batch into production cemetery, section, block, and lot tables:

```bash
npm run db:promote:spatial
npm run db:promote:spatial -- --batch-id <batch-uuid>
```

The geodatabase import prints the batch UUID when it completes. If you need to find it later, query `spatial_import_batches` in the target environment:

```bash
docker compose \
  -p cemeterymapping-test \
  --env-file db/env/test.env \
  exec db psql \
  -U cemetery_app \
  -d cemetery_mapping_test
```

```sql
SELECT
  id,
  source_name,
  source_path,
  source_format,
  imported_at,
  status,
  notes
FROM spatial_import_batches
ORDER BY imported_at DESC;
```

Use the `id` value as `<batch-uuid>`:

```bash
APP_ENV=test npm run db:promote:spatial -- --batch-id <batch-uuid>
```

Promotion currently handles `Cemeteries`, `Sections`, `Blocks`, and `Lots`. It refuses to run when the selected batch has staging `error` rows, but allows `warning` rows. Lots may be section-scoped when no block identifier is present, and a partial unique index keeps those section-scoped lot identifiers idempotent. Grave polygon import will need the actual gravesite source layer when it becomes available.

## Headstone spreadsheet workflow

Headstone GPS spreadsheets can be imported after cemetery and section polygons exist in the target environment. The importer expects one row per GPS location with `Latitude` and `Longitude` columns and up to six burial people stored in `Person1First` / `Person1Last` through `Person6First` / `Person6Last`. It also supports the legacy second-person headers `Persons26First` and `Persons26Last`.

Each spreadsheet row with coordinates and at least one person becomes one `lots` row, one `gravesites` row, and one `headstones` row. The importer generates a 10 foot by 20 foot lot `MultiPolygon` centered on the coordinate by default, with the 20 foot length running east-west, then generates a 4 foot by 10 foot gravesite `MultiPolygon` inside it. The database prevents more than five active gravesites from being linked to one lot. It stores the headstone itself as a `Point` at the GPS coordinate with `condition = 'unknown'`, links the gravesite to the matching cemetery, section polygon, and generated section-scoped lot when available, and replaces the generated gravesite's existing burial rows with one `burials` row per populated person column. It then creates `headstone_burials` join rows connecting the physical headstone to each imported burial. `PersonNYob` and `PersonNYod` become `YYYY-01-01` birth and death dates.

Lot ownership is tracked at the lot level with `lot_owner_parties`, `lot_ownership_events`, and `lot_ownership_event_parties`. Supported event types are `deed`, `sale`, `gift`, `church_council_action`, `correction`, and `release`; `current_lot_owners` exposes the latest non-release ownership state for each lot.

Source note prefixes from the workbook are expanded during import: `Nhg` means `North Hills Genealogists`, and `Tlc` means `Trinity Lutheran Church`. Existing burial notes from earlier imports are normalized by migrations so legacy `North Hills Guide` and typoed `North Hills Geneologists` text display and backfill to the official `North Hills Genealogists` spelling.

Run a dry run first:

```bash
APP_ENV=test npm run db:import:headstones -- "/path/to/TLC Gravesite Registry Geo Locations.xlsx" --dry-run
```

Import into a target environment:

```bash
APP_ENV=test npm run db:import:headstones -- "/path/to/TLC Gravesite Registry Geo Locations.xlsx"
```

Useful options:

```bash
APP_ENV=test npm run db:import:headstones -- "/path/to/headstones.xlsx" --facility-id 1 --lot-length-feet 20 --lot-width-feet 10 --length-feet 4 --width-feet 10
```

The generated `gravesite_id` values use the stable source row shape `TLC-GPS-<row-number>`. After import, run:

```bash
APP_ENV=test npm run db:validate:spatial
```

The importer validates generated center points before commit. A center point outside the cemetery is an error. A row whose GPS point does not fall inside a section polygon is imported with the source section text but no `section_uuid`, and is reported as a warning for review.

## Deed registry staging workflow

The 2022 Trinity deed registry is ownership evidence, not a spatial source. Import it into staging tables before creating real lot, gravesite, or ownership rows:

- `deed_registry_import_batches` records the workbook, sheet, target cemetery, and import notes.
- `deed_registry_entries` preserves one raw spreadsheet row per registry row, including owner text, raw lot text, raw section text, remarks, deed flags, parsed lot/plot/grave hints, confidence, and review status.
- `deed_registry_entry_allocations` stores one or more candidate allocations parsed from each row, such as Section G plots, standard lot identifiers, passage records, specific grave numbers, or grave-count-only hints.

The staging importer deliberately does not write to `lots`, `gravesites`, `lot_owner_parties`, `lot_ownership_events`, or the legacy `owners` table. Rows marked `low` or `review` confidence need human review before promotion. `NA` and `OC` are stored as aliases because they can map to more than one section; passageway records are also staged for manual spatial interpretation.

Run a dry run first:

```bash
APP_ENV=test npm run db:import:deed-registry -- "/Users/scottpeterson/Downloads/Trinity Cemetery Registry 2022.xlsx" --dry-run
```

Import into a target environment:

```bash
APP_ENV=test npm run db:import:deed-registry -- "/Users/scottpeterson/Downloads/Trinity Cemetery Registry 2022.xlsx" --source-name "Trinity Cemetery Registry 2022" --imported-by "Scott Peterson"
```

Useful review query:

```sql
SELECT
  source_row_number,
  owner_display_name,
  raw_lot_text,
  raw_section_text,
  ownership_scope,
  parse_confidence,
  parse_notes
FROM deed_registry_entries
ORDER BY source_row_number;
```
