---
---

# ADR 0003: Manage Schema Changes with Liquibase

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: Database changelog implementation, PR #298 fail-fast schema contract

## Context

The schema includes spatial tables, constraints, indexes, validation views, staging tables, and import-related tables. The project needs repeatable migrations across `DEV`, `TEST`, `STAGE`, and `PROD`, plus rollback testing in CI.

## Decision

Use Liquibase formatted SQL changesets under `db/changelog/changes`, included by `db/changelog/db.changelog-root.yaml`.

The API verifies its required Liquibase changeset in `databasechangelog` before it begins listening. If the required changeset is absent or the changelog table cannot be read, startup fails with instructions to run `npm run db:migrate`. Request handlers therefore target one current schema instead of probing `information_schema` for tables and columns on every request.

Core software:

| Software | Version | Purpose |
| --- | --- | --- |
| Liquibase container image | `liquibase/liquibase:4.33.0` | Database migration runner |
| PostgreSQL/PostGIS image | `postgis/postgis:17-3.5` | Migration target |

## Rationale

Liquibase gives the project an ordered changelog, a database changelog table, validation, rollback support, and a containerized migration runner. Formatted SQL lets migrations use native PostgreSQL and PostGIS features without hiding spatial behavior behind an ORM abstraction.

## Consequences

Every schema change must be a new changeset. Migration files must include rollback instructions. CI runs changelog validation, rollback testing, migrations, and status checks.

The required changeset exported by `server/schemaContract.mjs` must advance when a new changelog tip becomes mandatory for the running API. Deployments must apply migrations before starting the corresponding API build. This makes schema drift visible at startup and removes the latency and maintenance cost of supporting several historical query shapes at runtime.

Because formatted SQL is explicit, maintainers must be careful with destructive changes and rollback quality.

## Rebuild Notes

Validate the changelog:

```bash
APP_ENV=test npm run db:validate
```

Test rollback behavior:

```bash
APP_ENV=test npm run db:rollback:test
```

Apply migrations:

```bash
APP_ENV=test npm run db:migrate
```

Check status:

```bash
APP_ENV=test npm run db:status
```

Start the API only after status reports no pending changesets. An out-of-date database intentionally prevents the API from listening.

Current changelog files:

- `001-initial-schema.sql`
- `002-esri-cemetery-template-schema.sql`
- `003-spatial-import-staging.sql`
- `004-spatial-validation-severity.sql`
- `005-headstones.sql`
- `006-security-rbac-soft-delete-audit.sql`
- `007-cemetery-scoped-gravesite-identifiers.sql`
- `008-correct-north-hills-source-name.sql`
- `009-correct-north-hills-genealogists-spelling.sql`

## Update Triggers

Update this ADR when the migration tool changes, the changelog layout changes, the startup schema contract changes, rollback requirements change, or CI no longer exercises Liquibase validation and rollback.
