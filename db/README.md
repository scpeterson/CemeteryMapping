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

Local Docker ports:

```text
DEV:   localhost:5432 / cemetery_mapping_dev
TEST:  localhost:5433 / cemetery_mapping_test
STAGE: localhost:5434 / cemetery_mapping_stage
PROD:  localhost:5435 / cemetery_mapping_prod
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

Spatial validation reads the `spatial_validation_issues` view and exits non-zero if any issues are found. The current checks cover invalid geometry, parent/child containment, overlapping grave polygons, and basic geometry-type expectations for staged imports.

Load demo data into DEV/TEST/STAGE:

```bash
npm run db:seed:demo
APP_ENV=test npm run db:seed:demo
APP_ENV=stage npm run db:seed:demo
```

The demo seed command refuses to run when `APP_ENV=prod`.

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

## Changelog layout

```text
db/changelog/db.changelog-root.yaml
db/changelog/changes/001-initial-schema.sql
db/changelog/changes/002-esri-cemetery-template-schema.sql
db/changelog/changes/003-spatial-import-staging.sql
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
- `memorials`
- `spatial_import_batches`
- `spatial_import_features`

The spatial columns are:

- `cemeteries.geometry geometry(MultiPolygon, 4326)`
- `sections.geometry geometry(MultiPolygon, 4326)`
- `blocks.geometry geometry(MultiPolygon, 4326)`
- `lots.geometry geometry(MultiPolygon, 4326)`
- `gravesites.geometry geometry(MultiPolygon, 4326)`
- `memorials.geometry geometry(Point, 4326)`
- `spatial_import_features.geometry geometry(Geometry, 4326)`

Hierarchical GIS identifiers mirror the template fields using snake_case names:

- `facility_id`
- `section_id`
- `block_id`
- `lot_id`
- `grave_id`
- `gravesite_id`

Foreign keys connect the hierarchy directly in PostgreSQL, so Esri-specific relationship key fields are not needed.

## Spatial import staging

Real GIS imports should land in staging before production tables:

- `spatial_import_batches` records the source file/export, source format, source SRID, importer, and notes.
- `spatial_import_features` stores raw cemetery, section, block, lot, gravesite, and memorial features with source identifiers, original properties, and normalized 4326 geometry.
- `spatial_validation_issues` reports production and staging geometry issues before data is promoted.

The first staging model intentionally preserves source metadata as `jsonb`; once the first real source format is known, add a dedicated importer that loads into staging, runs `npm run db:validate:spatial`, and only promotes rows that pass validation.

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

The first inspected project geodatabase has populated `Cemeteries` and `Sections` layers, empty `Blocks`, `Lots`, and `Memorials` layers, and no visible `Gravesites` layer. Grave polygon import will need the actual gravesite source layer when it becomes available.
