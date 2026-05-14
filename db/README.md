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
```

The first schema creates:

- `cemeteries`
- `cemetery_sections`
- `grave_spaces`
- `owners`
- `people`
- `burials`
- `source_documents`
- `ownership_events`
- `ownership_event_owners`
- `grave_space_documents`
- `current_ownership_events` view
- `current_grave_owners` view

Current grave owners are intentionally derived from the latest ownership event instead of stored in a separate table.
