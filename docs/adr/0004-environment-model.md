# ADR 0004: Support DEV, TEST, STAGE, and PROD Environments

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: Environment-specific scripts and database configuration

## Context

The project needs repeatable local and CI workflows while preserving a path toward separate development, test, stage, and production databases. Database commands, API configuration, and frontend modes need to target the same environment.

## Decision

Use `APP_ENV=dev|test|stage|prod` as the environment selector. Provide npm convenience scripts for database, API, and frontend commands. Store local prototype database settings in `db/env/<environment>.env`.

Current local Docker database ports:

| Environment | Port | Database |
| --- | --- | --- |
| DEV | 5432 | `cemetery_mapping_dev` |
| TEST | 5433 | `cemetery_mapping_test` |
| STAGE | 5434 | `cemetery_mapping_stage` |
| PROD | 5435 | `cemetery_mapping_prod` |

## Rationale

One environment variable keeps scripts simple and makes CI explicit. Separate Docker volumes and ports allow multiple local environment databases to coexist. Vite modes align browser builds with the same environment vocabulary.

## Consequences

Most scripts default to `DEV`. Maintainers must explicitly set `APP_ENV=test`, `APP_ENV=stage`, or `APP_ENV=prod` when targeting those databases.

The checked-in `prod.env` is only for local/prototype infrastructure. Real production credentials must come from deployment secrets and must not be committed.

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

Override database connection values with:

```text
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
```

## Update Triggers

Update this ADR when environments are added or removed, ports change, credential handling changes, or deployment secrets replace local prototype environment files.
