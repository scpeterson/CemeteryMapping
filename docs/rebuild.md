---
---

# Rebuild Guide

[Documentation Home](index.md)

This guide describes how to rebuild the Cemetery Mapping system from a clean checkout. For design decisions and rationale, start with [Architecture Decision Records](adr/README.md).

If this is your first time setting up the project, start with [Getting Started](getting-started.md). That guide explains what to install on Mac and Windows, how to check each tool, and how to run the local demo. This rebuild guide is a more technical validation checklist.

## Prerequisites

Install:

- Node.js 24 or a compatible current Node.js version for local development
- npm
- Ruby 3.4.1
- Bundler 2.6.2
- Docker Desktop or Docker Engine with Docker Compose support
- GDAL/OGR on `PATH` when importing Esri File Geodatabases

The application containers provide:

- PostgreSQL/PostGIS: `postgis/postgis:17-3.5`
- Liquibase: `liquibase/liquibase:4.33.0`

## Clean Checkout Setup

```bash
git clone <repository-url>
cd CemeteryMapping
npm ci
```

## Start a Local Database

`db:up` creates or starts the Docker PostGIS container for the selected environment. It does not apply the database schema by itself. Run `db:migrate` after the container is healthy to create or update the schema from the Liquibase changelog.

| Environment | Start command | Docker container | Database | Host port |
| --- | --- | --- | --- | --- |
| DEV | `npm run db:up` | `cemetery-mapping-db-dev` | `cemetery_mapping_dev` | `5432` by default; local overrides may use another port |
| TEST | `npm run db:up:test` or `APP_ENV=test npm run db:up` | `cemetery-mapping-db-test` | `cemetery_mapping_test` | `5433` |

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

The DEV and TEST containers use separate Docker Compose projects, databases, ports, and Docker volumes, so they can exist side by side on the same machine.

## Load Demo Data

`db:seed:demo` is a separate optional step. Demo data is allowed in DEV, TEST, and STAGE only:

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

## Validate the Documentation Site

The GitHub Pages documentation site is built from the `docs/` folder with Jekyll.

```bash
cd docs
bundle install
bundle exec jekyll build
```

The current documentation bundle pins Jekyll and its plugins in `docs/Gemfile` and `docs/Gemfile.lock`.
Before running the commands, confirm your shell is using the Ruby 3.4.1 toolchain:

```bash
ruby --version
bundle --version
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

To refresh only existing section boundaries from a staged FileGDB batch, use the focused section promotion command instead of the full spatial promotion. This preserves cemetery, lot, and section text data while replacing the selected section geometries:

```bash
APP_ENV=test npm run db:promote:section-geometry -- --batch-id <batch-uuid> --facility-id 1 --sections B,G
```

After the Trinity Section B/G refresh, `sections.geometry` is required again. If a new section is created before geometry is available, stage and promote its section geometry before applying migrations that restore the `NOT NULL` constraint.

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
