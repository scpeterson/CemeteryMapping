# Rebuild Guide

[Documentation Home](index.md)

This guide describes how to rebuild the Cemetery Mapping system from a clean checkout. For design decisions and rationale, start with [Architecture Decision Records](adr/README.md).

## Prerequisites

Install:

- Node.js 24 or a compatible current Node.js version for local development
- npm
- Docker Desktop or Docker Engine with Docker Compose support
- GDAL/OGR on `PATH` when importing Esri File Geodatabases

The application containers provide:

- PostgreSQL/PostGIS: `postgis/postgis:16-3.4`
- Liquibase: `liquibase/liquibase:4.33.0`

## Clean Checkout Setup

```bash
git clone <repository-url>
cd CemeteryMapping
npm ci
```

## Start a Local Database

DEV is the default environment:

```bash
npm run db:up
npm run db:migrate
```

For TEST:

```bash
APP_ENV=test npm run db:up
APP_ENV=test npm run db:migrate
```

## Load Demo Data

Demo data is allowed in DEV, TEST, and STAGE only:

```bash
npm run db:seed:demo
APP_ENV=test npm run db:seed:demo
```

## Run the Application

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The API listens on:

```text
http://127.0.0.1:3001
```

## Validate the Build

```bash
npm run lint
npm run build
APP_ENV=test npm run test:e2e
```

## Validate Database Migrations

```bash
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:rollback:test
APP_ENV=test npm run db:migrate
APP_ENV=test npm run db:status
```

## Validate Spatial Data

```bash
APP_ENV=test npm run db:validate:spatial
```

Spatial validation can report warnings for known review items. It should exit successfully when there are zero blocking errors.

## Import Real Cemetery and Section Geometry

Source details are tracked in [ADR 0007](adr/0007-file-geodatabase-cemetery-section-import.md).

```bash
APP_ENV=test npm run db:import:geodatabase -- "/path/to/Cemetery Data Management.gdb" --source-name "Cemetery Data Management"
APP_ENV=test npm run db:validate:spatial
APP_ENV=test npm run db:promote:spatial -- --batch-id <batch-uuid>
```

The geodatabase import prints the batch UUID. To look it up later:

```bash
docker compose \
  -p cemeterymapping-test \
  --env-file db/env/test.env \
  exec db psql \
  -U cemetery_app \
  -d cemetery_mapping_test
```

```sql
SELECT id, source_name, source_path, imported_at, status
FROM spatial_import_batches
ORDER BY imported_at DESC;
```

Use the `id` value as `<batch-uuid>`.

## Import Headstone GPS Spreadsheet Data

Source details are tracked in [ADR 0008](adr/0008-headstone-spreadsheet-import.md).

Dry run:

```bash
APP_ENV=test npm run db:import:headstones -- "/path/to/TLC Gravesite Registry Geo Locations.xlsx" --dry-run
```

Real import:

```bash
APP_ENV=test npm run db:import:headstones -- "/path/to/TLC Gravesite Registry Geo Locations.xlsx"
```

## ADR Maintenance Requirement

Every PR that changes architecture, schema, import behavior, validation policy, deployment/rebuild behavior, or source data assumptions must add or update an ADR in `docs/adr`.

If a decision is replaced, do not rewrite history. Add a new ADR and mark the old one `Superseded`.
