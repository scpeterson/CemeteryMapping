---
---

# ADR 0003: Manage Schema Changes with Liquibase

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: Database changelog implementation

## Context

The schema includes spatial tables, constraints, indexes, validation views, staging tables, and import-related tables. The project needs repeatable migrations across `DEV`, `TEST`, `STAGE`, and `PROD`, plus rollback testing in CI.

## Decision

Use Liquibase formatted SQL changesets under `db/changelog/changes`, included by `db/changelog/db.changelog-root.yaml`.

Core software:

| Software | Version | Purpose |
| --- | --- | --- |
| Liquibase container image | `liquibase/liquibase:4.33.0` | Database migration runner |
| PostgreSQL/PostGIS image | `postgis/postgis:16-3.4` | Migration target |

## Rationale

Liquibase gives the project an ordered changelog, a database changelog table, validation, rollback support, and a containerized migration runner. Formatted SQL lets migrations use native PostgreSQL and PostGIS features without hiding spatial behavior behind an ORM abstraction.

## Consequences

Every schema change must be a new changeset. Migration files must include rollback instructions. CI runs changelog validation, rollback testing, migrations, and status checks.

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

Current changelog files:

- `001-initial-schema.sql`
- `002-esri-cemetery-template-schema.sql`
- `003-spatial-import-staging.sql`
- `004-spatial-validation-severity.sql`
- `005-headstones.sql`

## Update Triggers

Update this ADR when the migration tool changes, the changelog layout changes, rollback requirements change, or CI no longer exercises Liquibase validation and rollback.
