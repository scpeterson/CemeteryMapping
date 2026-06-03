---
---

# ADR 0004: Support DEV, TEST, STAGE, and PROD Environments

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: Environment-specific scripts and database configuration

## Context

The project needs repeatable local and CI workflows while preserving a path toward separate development, test, stage, and production databases. Database commands, API configuration, and frontend modes need to target the same environment.

## Decision

Use `APP_ENV=dev|test|stage|prod` as the environment selector. Provide npm convenience scripts for database, API, and frontend commands. Store local prototype database settings in `db/env/<environment>.env`. Allow gitignored `db/env/<environment>.local.env` files to override those defaults for machine-specific settings.

Promotion between environments follows the same vocabulary:

1. `DEV` is for implementation and exploratory local data work.
2. `TEST` is for automated rebuild, rollback, unit, integration, build, and end-to-end validation.
3. `STAGE` is for production-like release rehearsal using the target configuration shape and representative data.
4. `PROD` is for live cemetery records.

Code is promoted by Git history and PRs. Schema is promoted by Liquibase migrations. Reviewed data is promoted by environment-targeted import, promotion, or maintenance scripts. Secrets and Auth0 tenant values are configured per environment and are not promoted through source control.

Current local Docker database ports:

| Environment | Port | Database |
| --- | --- | --- |
| DEV | 5432 | `cemetery_mapping_dev` |
| TEST | 5433 | `cemetery_mapping_test` |
| STAGE | 5434 | `cemetery_mapping_stage` |
| PROD | 5435 | `cemetery_mapping_prod` |

## Rationale

One environment variable keeps scripts simple and makes CI explicit. Separate Docker volumes and ports allow multiple local environment databases to coexist. Vite modes align browser builds with the same environment vocabulary.

The promotion ladder keeps three concerns separate:

- Code changes become releasable only after PR checks pass.
- Schema changes are replayable because every environment runs the same Liquibase changelog.
- Data changes stay intentional because imports first land in staging/review tables or reviewed scripts before writing authoritative tables.

`STAGE` exists to catch deployment, Auth0, storage, migration, and representative-data issues that CI cannot fully simulate.

## Consequences

Most scripts default to `DEV`. Maintainers must explicitly set `APP_ENV=test`, `APP_ENV=stage`, or `APP_ENV=prod` when targeting those databases.

Local override files are intentionally untracked. They let a maintainer move the DEV Docker host port away from `5432` when a local PostgreSQL service is already listening there, while keeping the shared DEV default unchanged.

The checked-in `prod.env` is only for local/prototype infrastructure. Real production credentials must come from deployment secrets and must not be committed.

Merging to `main` does not automatically promote data. A release can include code only, schema only, data only, or a coordinated combination. Production-affecting releases need a backup and rollback or forward-fix plan before `APP_ENV=prod` commands are run.

## Rebuild Notes

Start databases:

```bash
npm run db:up
npm run db:up:test
npm run db:up:stage
npm run db:up:prod
```

Apply migrations to a specific environment:

```bash
APP_ENV=test npm run db:migrate
```

Run API/frontend together:

```bash
npm run dev
npm run dev:test
npm run dev:stage
npm run dev:prod
```

Promote through environments:

```bash
# DEV: local implementation checks
APP_ENV=dev npm run db:migrate
npm run lint
npm run test:server
npm run build

# TEST: CI uses APP_ENV=test and rebuilds the database from migrations.
# For local verification of database changes:
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:rollback:one
APP_ENV=test npm run db:migrate
APP_ENV=test npm run test:db-rules

# STAGE: release rehearsal
APP_ENV=stage npm run db:status
APP_ENV=stage npm run db:migrate

# PROD: live release after backup, STAGE smoke test, and rollback plan
APP_ENV=prod npm run db:status
APP_ENV=prod npm run db:migrate
```

Override database connection values with:

```text
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
```

## Update Triggers

Update this ADR when environments are added or removed, ports change, credential handling changes, promotion gates change, release rollback policy changes, or deployment secrets replace local prototype environment files.
