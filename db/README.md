# Database

This project uses Liquibase to manage a PostgreSQL/PostGIS schema for cemetery GIS and records data.

## Local database

Start Postgres/PostGIS:

```bash
npm run db:up
```

Apply migrations:

```bash
npm run db:migrate
```

Check migration status:

```bash
npm run db:status
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

Stop the local database:

```bash
npm run db:down
```

## Connection

The local Docker database uses:

```text
host: localhost
port: 5432
database: cemetery_mapping
user: cemetery_app
password: cemetery_app_dev
```

## Changelog layout

```text
db/changelog/db.changelog-root.yaml
db/changelog/changes/001-initial-schema.sql
db/changelog/changes/002-esri-cemetery-template-schema.sql
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

The spatial columns are:

- `cemeteries.geometry geometry(MultiPolygon, 4326)`
- `sections.geometry geometry(MultiPolygon, 4326)`
- `blocks.geometry geometry(MultiPolygon, 4326)`
- `lots.geometry geometry(MultiPolygon, 4326)`
- `gravesites.geometry geometry(MultiPolygon, 4326)`
- `memorials.geometry geometry(Point, 4326)`

Hierarchical GIS identifiers mirror the template fields using snake_case names:

- `facility_id`
- `section_id`
- `block_id`
- `lot_id`
- `grave_id`
- `gravesite_id`

Foreign keys connect the hierarchy directly in PostgreSQL, so Esri-specific relationship key fields are not needed.
