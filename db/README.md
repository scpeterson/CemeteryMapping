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
- `gravesite_status_types`
- `burials`
- `owners`
- `headstone_condition_types`
- `marker_types`
- `marker_material_types`
- `headstones`
- `headstone_gravesites`
- `headstone_burials`
- `lot_ownership_event_types`
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

Operational gravesite status uses `gravesite_status_types.id` as the canonical UUID lookup key through `gravesites.status_type_id`, but the displayed status is derived from record facts. `needs_review` is an explicit human flag stored on the gravesite. Otherwise, an active interred burial makes the gravesite `occupied`; no active interred burial plus a current deed or ownership right for the gravesite or its lot makes it `sold`; and a `pre_need_inscription` burial record status makes an otherwise unsold gravesite `reserved`, because the marker names a future interment but the person is not yet buried there. No active interred burial, current ownership right, or pre-need inscription makes it `available`. Remaining unmatched cases display as `unknown`. Application reads, searches, and map rendering use this derived status; the legacy `gravesites.status` lowercase code column has been removed.

Maintenance is tracked as dated operational history rather than as permanent marker or gravesite attributes. `maintenance_records` can link to a gravesite, a headstone, or both, and records either an issue, an action, or both. Controlled lookup tables store issue types such as `illegible`, `listing`, `broken`, `grass_needed`, and `needs_leveling`; action types such as `cleaned`, `reset_straightened`, `repaired`, `grass_planted`, and `leveled`; and priority values. Open records act as work items, completed records preserve maintenance history, and reports can list open needs or markers that have not been cleaned within a selected number of days.

Sections also include `alternate_names text[]` for locally used names that differ from the primary section label. The current migrations backfill active sections `B` and `D` with `OC` and `Original Cemetery`, and active sections `A` and `C` with `NA` and `New Annex`. Sections also include `notes varchar(4000)` for administrative context. Section geometry is nullable so known sections can be recorded before surveyed spatial boundaries are available; map queries only render sections that already have geometry. Admin users can edit these aliases and notes from the Admin UI Cemetery Records tab.

## Security schema

The security foundation uses:

- `app_roles` for application roles. Current values are `reader`, `power-user`, `cemetery-admin`, and `admin`.
- `app_users` for identity-provider subjects mapped to application roles.
- `app_user_cemetery_access` for cemetery-scoped edit assignments used by `power-user` and `cemetery-admin` users.
- `audit_events` for append-only row-level change history.
- `audit_retention_policies` for the global audit retention window and purge batch size.
- `system_events` for operational failures, warnings, health-check failures, integration failures, and scheduled job runs.
- `deleted_at`, `deleted_by`, and `delete_reason` columns on cemetery business tables.

The application should use soft deletes for cemetery data. Normal read queries should filter `deleted_at IS NULL`; administrative recovery and audit views can explicitly include deleted rows.

Database triggers write `audit_events` records for inserts, updates, soft deletes, restores, and hard deletes across the core cemetery and admin tables. API mutation paths set transaction-local audit context so audit rows include the application user, role, identity-provider subject, and email. Direct database changes are also captured with PostgreSQL `current_user` and `session_user`; use unique named database login roles for every person or automation with direct database access, granted through PostgreSQL group roles that mirror the application roles. See the [Database Auditing](../docs/database-auditing.md) guide.

Audit retention is controlled by the singleton `audit_retention_policies` row. The default keeps seven years of audit events and removes old rows in `5000` row batches through `npm run db:purge:audit`.

Operational failure reporting uses `system_events`, separate from row-level data auditing. Unexpected API 500s, failed health checks, and scheduled job start/end/failure records are stored there and visible to admins from the Admin UI System tab.

The Admin UI Quality tab is query-only. It derives cleanup counts from existing cemetery, North Hills OCR, media, veteran, and maintenance tables rather than storing separate data-quality issue rows.

Database triggers also maintain `updated_at` on current tables that expose that lifecycle column. Application code should not set `updated_at` manually for normal row updates.

Current API authorization modes:

- `AUTH_MODE=disabled`: development/test default. Requests are treated as a local admin.
- `AUTH_MODE=trusted-header`: controlled integration mode. A trusted proxy must provide `x-cemetery-user-subject`, `x-cemetery-user-email`, and `x-cemetery-user-role`.
- `AUTH_MODE=auth0`: production mode. The API validates Auth0 JWT bearer tokens and loads the local `app_users` record by `external_subject`.

Trusted-header mode is not a production identity-provider replacement.

For Auth0 users, `app_users.external_subject` must match the token `sub` claim, `app_users.role_name` must be `reader`, `power-user`, `cemetery-admin`, or `admin`, and `app_users.is_active` must be `true`. Deactivating a user sets `is_active` to `false`, blocking application access without deleting the Auth0 account or local mapping. Cemetery-scoped edit and deed/owner access for `power-user` and `cemetery-admin` users is stored in `app_user_cemetery_access`.

## Spatial import staging

Real GIS imports should land in staging before production tables:

- `spatial_import_batches` records the source file/export, source format, source SRID, importer, and notes.
- `spatial_import_features` stores raw cemetery, section, block, lot, gravesite, and memorial features with source identifiers, original properties, and normalized 4326 geometry.
- `spatial_validation_issues` reports production and staging geometry issues before data is promoted.

The first staging model intentionally preserves source metadata as `jsonb`. Importers load into staging first, validation separates errors from warnings, and promotion refuses batches that still have staging errors.

## North Hills OCR reading staging

Searchable North Hills Genealogists PDFs can be staged for review without changing production burial or headstone rows:

```bash
APP_ENV=dev npm run db:import:north-hills-ocr -- "/path/to/FedEx Scan 2026-05-29_10-13-35.pdf" --imported-by "Name"
```

The importer uses `pdftotext -layout` for searchable PDFs, preserves the raw OCR entry text, parses the visible North Hills section/row/position coordinate, marker descriptors, surnames, inscription text, and detected years, then writes to `north_hills_ocr_import_batches` and `north_hills_ocr_entries`. The Admin -> Readings screen compares staged OCR entries to existing burials using source page references, surnames, and birth/death years. Reviewed assignments are stored in `north_hills_ocr_entry_gravesite_links` and `north_hills_ocr_entry_headstone_links` with status, confidence, reviewer identity, timestamp, and optional notes. CR and CRG annotations are staged in `north_hills_ocr_source_facts` as source evidence; reviewed death-date facts can be promoted to a matched burial while keeping the original church-record wording and audit history.

Some NHG sections include church, funeral-home, or family-history records where NHG found no matching tombstone. Those people belong in `source_person_records` rather than fake `burials`, `gravesites`, or `headstones`. The row can reference the NHG entry or source fact, preserve partial date text, and remain `unmatched` until research finds a physical cemetery object. Later, `source_person_record_links` can record candidate, matched, or rejected links to a real burial, gravesite, or marker. The Admin UI Quality tab counts unmatched and candidate source person records so source-only people do not disappear from cleanup work.

## Media asset tracking

Photos and future document scans are tracked as media evidence rather than embedded in a cemetery, gravesite, or headstone row. The database stores metadata in `media_assets` and relationships in link tables:

- `gravesite_media_assets`
- `headstone_media_assets`

This allows one photo to document a gravesite overview, a specific marker, or both. It also allows a marker photo to remain linked when a headstone spans more than one gravesite.

The application stores local upload files under `uploads/media` by default and serves them from `/media/<storage_key>`. In this workspace, that default resolves to:

```text
/Users/scottpeterson/Dev/CemeteryMapping/uploads/media
```

The file name on disk is generated from the `media_assets.id` UUID plus the detected extension, such as `fdb26c81-0878-4520-8f1b-69242bc7b049.jpg`. The original Apple Photos filename, for example `IMG_5151.jpeg`, is preserved in `media_assets.original_filename`. Postgres stores metadata, the public `file_url`, and link-table relationships; it does not store the image bytes.

Set `MEDIA_UPLOAD_DIR=/absolute/path` for another local storage location. Production deployments should replace local disk with durable object storage or a backed-up shared volume; Postgres should keep only metadata, URLs, and relationships.

Media rows and link rows are audited by database triggers. Uploads performed through the API include application-user audit context, while direct database changes still capture database user/session fields.

## File Geodatabase workflow

The first real source format is expected to be an Esri File Geodatabase folder ending in `.gdb`. The local inspection/export commands require GDAL/OGR on your PATH.

Inspect available layers:

```bash
npm run geodatabase:inspect -- /path/to/cemetery.gdb
```

Export a layer to normalized GeoJSON in EPSG:4326. The current Cemetery Data Management geodatabase stores its mapped cemetery layers in Web Mercator (`EPSG:3857`), so the export helper declares `EPSG:3857` as the source CRS before transforming to `EPSG:4326`:

```bash
npm run geodatabase:export -- /path/to/cemetery.gdb Gravesites /tmp/cemetery-import/gravesites.geojson
```

Import recognized Esri Cemetery Management layers into staging:

```bash
npm run db:import:geodatabase -- /path/to/cemetery.gdb --source-name "Cemetery Data Management"
```

The importer currently reads `Cemeteries`, `Sections`, `Blocks`, `Lots`, and `Memorials`, treats the source geodatabase geometry as Web Mercator (`EPSG:3857`), normalizes geometries to EPSG:4326, records `source_srid = 3857` on the import batch, and preserves original File Geodatabase attributes in `spatial_import_features.source_properties`.

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

For cemetery and section boundary corrections where local text fields must be preserved, use the geometry-only boundary promotion command instead of full spatial promotion. This updates only `cemeteries.geometry`, `sections.geometry`, and their `updated_at` values for the requested facility and section names:

```bash
npm run db:promote:boundary-geometry -- --batch-id <batch-uuid> --facility-id 1 --sections A,B,C,D,E,F
```

The command prints old area, new area, and symmetric changed area for each promoted cemetery and section so no-op sanity checks are easy to identify.

For section-only corrections, use the narrower section geometry command. This updates only `sections.geometry` and `sections.updated_at` for the requested facility and section names:

```bash
npm run db:promote:section-geometry -- --batch-id <batch-uuid> --facility-id 1 --sections B,D,F
```

Use this when a geodatabase section boundary has been redrawn but cemetery, section, lot, and contact text in the application should remain authoritative.

## Headstone spreadsheet workflow

Headstone GPS spreadsheets can be imported after cemetery and section polygons exist in the target environment. The importer expects one row per GPS location with `Latitude` and `Longitude` columns and up to six burial people stored in `Person1First` / `Person1Last` through `Person6First` / `Person6Last`. It also supports the legacy second-person headers `Persons26First` and `Persons26Last`.

Each spreadsheet row with coordinates and at least one person becomes one `lots` row, one `gravesites` row, and one `headstones` row. The importer generates a 10 foot by 20 foot lot `MultiPolygon` centered on the coordinate by default, with the 20 foot length running east-west, then generates a 10 foot by 4 foot gravesite `MultiPolygon` inside it. For generated gravesites in Trinity sections `A` through `D`, the headstone coordinate is treated as the center of the gravesite's left/west short edge and the placeholder gravesite extends 10 feet east and 4 feet north-south. Other generated gravesites remain centered on the coordinate until more section-specific placement rules are known. The database prevents more than five active gravesites from being linked to one lot. It stores the headstone itself as a `Point` at the GPS coordinate with `condition = 'unknown'`, `marker_type_code = 'unknown'`, and `material_type_code = 'unknown'`, links the gravesite to the matching cemetery, section polygon, and generated section-scoped lot when available, and replaces the generated gravesite's existing burial rows with one `burials` row per populated person column. It then creates `headstone_gravesites` rows connecting the physical headstone to its primary gravesite, and `headstone_burials` rows connecting the physical headstone to each imported burial. The legacy `headstones.gravesite_uuid` column remains as the current primary anchor for existing code; `headstone_gravesites` is the forward-looking relationship table for markers that span or relate to more than one gravesite. Marker form/style and material are normalized through `marker_types` and `marker_material_types`; the older text columns remain for compatibility during the transition. `PersonNYob` and `PersonNYod` become `YYYY-01-01` birth and death dates.

Ownership is modeled in two layers. The older lot-specific tables, `lot_owner_parties`, `lot_ownership_events`, and `lot_ownership_event_parties`, remain for compatibility with existing A-E lot ownership data. The generalized ownership layer uses `ownership_parties`, `ownership_events`, `ownership_event_parties`, and `ownership_event_rights` so a deed or transfer can apply to a whole lot, one or more specific gravesites, a section-level placeholder, or an unlocated burial right that still needs review. Supported event types are `deed`, `sale`, `gift`, `church_council_action`, `correction`, and `release`; the generalized layer reuses `lot_ownership_event_types` until the lookup is renamed. `current_ownership_right_owners` exposes the latest non-release ownership state for each target right.

Use lot rights for ordinary Sections A-E deeds that convey a full 10 by 20 foot lot. Use gravesite rights for Section G, where plots are gravesites deeded directly, and for transfers of one or more specific graves from an A-E lot. Use unlocated rights only when the record documents a right, such as "two graves from Lot 12," but the exact gravesites have not been identified yet. Migration `041-generalized-ownership-rights.sql` backfills generalized lot rights from the existing lot ownership tables but does not remove or rewrite those legacy tables.

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
APP_ENV=test npm run db:import:headstones -- "/path/to/headstones.xlsx" --facility-id 1 --lot-length-feet 20 --lot-width-feet 10 --length-feet 10 --width-feet 4
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
- `deed_registry_entry_allocations` stores one or more candidate allocations parsed from each row, such as Section G gravesite hints, standard lot identifiers, passage records, specific grave numbers, or grave-count-only hints.

The staging importer deliberately does not write to `lots`, `gravesites`, `ownership_parties`, `ownership_events`, `ownership_event_rights`, the compatibility lot ownership tables, or the legacy `owners` table. Rows marked `low` or `review` confidence need human review before promotion. `NA` and `OC` are stored as aliases because they can map to more than one section; passageway records are also staged for manual spatial interpretation.

Section F and Section G have explicit business rules. Section F cannot contain gravesites because of underground utility lines. Section G uses the word `plot` for individual gravesites, not standard 10 by 20 foot lots; those gravesites are 8 by 4 feet, the source plan shows north at the bottom, and Section G can contain only flat markers. Migration `030-section-marker-business-rules.sql` enforces these rules with database triggers so imports, scripts, and direct database edits cannot bypass them. Section G staged entries therefore preserve source plot numbers in `parsed_plot_numbers`, also copy them into `parsed_grave_numbers`, and create `section_g_gravesite` allocation rows with both `plot_identifier` and `grave_number` populated. Migration `042-section-g-deed-holders.sql` imports the populated page 2 deed-holder list into generalized gravesite ownership rights, not lots.

Run a dry run first:

```bash
APP_ENV=test npm run db:import:deed-registry -- "/Users/scottpeterson/Downloads/Trinity Cemetery Registry 2022.xlsx" --dry-run
```

Import into a target environment:

```bash
APP_ENV=test npm run db:import:deed-registry -- "/Users/scottpeterson/Downloads/Trinity Cemetery Registry 2022.xlsx" --source-name "Trinity Cemetery Registry 2022" --imported-by "Scott Peterson"
```

The same workbook also contains an `Investigated` sheet. Import it as a separate staging batch so its owner rows and interleaved research notes remain traceable to that worksheet:

```bash
APP_ENV=test npm run db:import:deed-registry -- "/Users/scottpeterson/Downloads/Trinity Cemetery Registry 2022.xlsx" --sheet "Investigated" --source-name "Trinity Cemetery Registry 2022 - Investigated" --imported-by "Scott Peterson"
```

`Investigated` rows with owner data are staged as owner records. Note-only rows are staged as investigation notes: the original cells remain in `source_row`, while the disposition and remarks are combined into `raw_remarks` and left for review instead of being parsed as a lot assignment.

Admins can review staged deed registry evidence in the Admin UI Deed Evidence tab. The view is read-only and supports batch selection, confidence filtering, evidence-type filtering, owner/lot/section/remark search, parser notes, and related notes from the latest `Investigated` import batch.

Useful direct database review query:

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
