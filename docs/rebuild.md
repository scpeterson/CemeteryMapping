---
---

# Rebuild Guide

[Documentation Home](index.md)

This guide describes how to rebuild the Cemetery Mapping system from a clean checkout. For design decisions and rationale, start with [Architecture Decision Records](adr/README.md).

If this is your first time setting up the project, start with [Getting Started](getting-started.md). That guide explains what to install on Mac and Windows, how to check each tool, and how to run the local demo. This rebuild guide is a more technical validation checklist.

Existing PostgreSQL 17 environments must follow the [PostgreSQL 18 upgrade guide](postgresql-18-upgrade.md) before restarting the root Compose database. Fresh databases use the normal setup below. Hosted TEST has a separate pinned database configuration.

## Prerequisites

Install:

- Node.js 24 or a compatible current Node.js version for local development
- npm
- Ruby 3.4.1
- Bundler 2.6.2
- Docker Desktop or Docker Engine with Docker Compose support
- GDAL/OGR on `PATH` when importing Esri File Geodatabases

The application containers provide:

- PostgreSQL/PostGIS: `cemeterymapping-postgis:18-3.7-tiger3.6.4` (built from digest-pinned bases in `deploy/database/Dockerfile`; see [upgrade procedure](postgresql-18-upgrade.md))
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
npm run db:configure-api
```

For TEST:

```bash
APP_ENV=test npm run db:up
APP_ENV=test npm run db:migrate
APP_ENV=test npm run db:configure-api
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
npm run check:bundle
APP_ENV=test npm run test:e2e
```

`npm run build` already runs the bundle-size check for production output. The explicit `npm run check:bundle` command confirms the generated `dist/assets` files still satisfy the documented gzip budgets and is useful when diagnosing a size failure.

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

Run rollback testing only against disposable TEST data after reviewing pending changesets. Changesets 461–472 have empty rollback actions: this check does not reverse their data changes or validate backup recovery. Rehearse these corrections and their recovery on an isolated database copy; see [Rollback and backup recovery](https://github.com/scpeterson/CemeteryMapping/blob/main/db/README.md#rollback-and-backup-recovery).

```bash
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:rollback:test
APP_ENV=test npm run db:migrate
APP_ENV=test npm run db:configure-api
APP_ENV=test npm run db:status
```

## Refresh Planner Statistics After a Restore

For a persistent local DEV/TEST database restored from a logical backup, complete
schema migration and runtime-role configuration, then explicitly refresh planner
statistics before judging performance:

```bash
npm run db:benchmark -- --env test --refresh-statistics
```

Use `--env dev` for DEV. This runs `ANALYZE` and benchmarks read-only application
queries; it does not seed or change application records. Retain the private
output and compare spatial fingerprints. See [benchmark methodology and dated results](postgresql-18-upgrade.md#planner-statistics-and-query-benchmarks).
This local command does not maintain the separately hosted TEST stack.

## Validate Spatial Data

```bash
APP_ENV=test npm run db:validate:spatial
```

Spatial validation can report warnings for known review items. It should exit successfully when there are zero blocking errors.
For existing local data, compare findings with the recorded baseline rather than
assuming a clean rebuild fixture represents the restored database. Use the
[read-only spatial repair previews](postgresql-18-upgrade.md#reversible-spatial-repair-previews)
to investigate candidate changes while preserving stored geometry. Preview
generation does not resolve validation errors.

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


## Map and passageway schema through migration 504

The passageway release originally required `502-passageway-area-type`. The current
API requires migration 516; see [current requirements](#current-schema-and-workspace-release). Migrations 502–503 add typed passageways, original
registry location references, individual-rights enforcement and the ten approved
Trinity polygons. Migration 504 adjusts the southern C rows and C-P03. Real-data
geometry migrations may skip a database without their source cemetery; do not
copy Trinity personal records into demo data to force them to run.

On a disposable migrated TEST database, run:

```bash
APP_ENV=test npm run db:rollback:test
APP_ENV=test npm run db:migrate
APP_ENV=test npm run db:configure-api
APP_ENV=test npm run test:server
APP_ENV=test npm run test:db-rules
npm run lint
npm run build
APP_ENV=test npm run test:e2e
```

`db:rollback:test` is a rebuild/replay check, not a recovery procedure for populated
DEV or hosted TEST. Migrations 502–504 use empty automatic rollback to preserve
linked data; recover those changes from a validated backup or a reviewed forward
correction. Migration 502 explicitly recognizes its verified original DEV checksum;
do not clear unrelated checksums. Geometry rehearsals and post-application checks
compare protected records and audit counts before release. See
[the map guide](map-layout-and-passageways.md) and
[ADR evidence package](adr/supporting/passageway-review-2026-10-29/README.md).

## CI validation paths

CI runs quick checks, serial database integration tests and four isolated browser
shards in parallel. Recognized documentation-only PRs build and validate the docs;
every main push still runs application validation. The required
`Lint, build, and test` aggregate remains the hosted deployment gate. See
[ADR 0181](adr/0181-parallel-ci.md) for classification, caches, isolation and recovery.


## Current schema and workspace release

The API startup guard requires `516-maintenance-task-scheduling`. Apply all pending
changesets in order; checking for military-unit migration 510 or passageway
migration 502 alone is insufficient. The new schema additions are:

| Migration | Purpose |
|---|---|
| 513 | Transactional field-operation receipts for safe synchronization retries |
| 514 | Immutable staged import source, review and approval history |
| 515 | Person-merge evidence and guards against new references to archived people |
| 516 | Maintenance assignments, calendar dates, reminder reset and work-queue indexes |

After backing up a persistent target and rehearsing its pending migrations on an
isolated copy, apply migrations and refresh the restricted runtime grants before
starting the matching API. Local DEV commands are:

```bash
APP_ENV=dev npm run db:validate
APP_ENV=dev npm run db:migrate
APP_ENV=dev npm run db:configure-api
npm ci
npm run build:dev
npm run dev
```

Use the target's own configuration and [hosted release procedure](hosted-test.md)
for hosted TEST. Retain the existing PostgreSQL 18 volume selection and local
Compose override; do not recreate the database against an older volume. Changes
to environment files require restarting the relevant services. `db:configure-api`
writes the local runtime credential file: run it from the target checkout, not
an isolated worktree whose ignored environment file points at another environment.

The field worker and asset manifest are produced by `npm run build:test` or
`npm run build:prod`. Serve the build through the target HTTPS frontend and use
**Prepare offline page loading**; Vite development mode does not provide offline
page reload. Static caching is limited to the field shell/assets, not private API
or media responses. Keep field-operation receipts with the database so uncertain
retries remain deduplicated. Rollback of these features can remove receipt,
import/merge evidence or task scheduling data; use reviewed recovery that accounts
for later edits rather than rolling back a populated environment as a test.

See [release status](release-status.md) for dated DEV evidence and pending TEST
promotion, and [operator workflows](operator-workflows.md#offline-field-collection)
for the user procedures. The public deployment record excludes private backup
paths; those are retained in the private operations manual.
