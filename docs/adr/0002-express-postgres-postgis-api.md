---
---

# ADR 0002: Use an Express API Backed by PostgreSQL and PostGIS

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: Initial API and database implementation

## Context

The application needs a local API that serves cemetery map geometry, grave detail records, and search results from a relational/spatial data store. The data includes cemetery boundaries, sections, generated gravesite polygons, headstone points, burials, owners, and search fields.

## Decision

Use an Express API running on Node.js. Store canonical application data in PostgreSQL with PostGIS enabled.

Core backend software:

| Software | Version | Purpose |
| --- | --- | --- |
| Node.js | 24 in CI | JavaScript runtime |
| Express | 5.2.1 | HTTP API server |
| pg | 8.21.0 | PostgreSQL client |
| PostgreSQL/PostGIS image | `postgis/postgis:17-3.5` | Relational and spatial database |

## Rationale

Express is small, direct, and enough for the current API surface. It keeps API routes close to repository logic without a larger framework. PostgreSQL provides transactional relational data for cemetery records. PostGIS adds spatial types, indexes, containment checks, overlap checks, GeoJSON output, and geometry transformations.

The `pg` library is the standard low-level PostgreSQL client for Node.js and works well with explicit SQL, which is useful while the schema is still evolving.

Repository code must not issue overlapping `client.query()` calls on the same checked-out `pg` client. Use sequential `await` calls on one client, or use separate pool queries/clients when true database concurrency is needed.

## Consequences

The application remains easy to run locally with Docker and npm scripts. SQL is explicit and inspectable, but maintainers must keep queries synchronized with Liquibase migrations.

Spatial behavior depends on PostGIS. A plain PostgreSQL database is not sufficient.

## Rebuild Notes

Start a local database:

```bash
npm run db:up
```

Apply schema:

```bash
npm run db:migrate
```

Run API:

```bash
npm run api
```

The API listens on:

```text
http://127.0.0.1:3001
```

Key routes:

- `GET /api/health`
- `GET /api/cemetery-map`
- `GET /api/cemeteries/:cemeteryId/grave-spaces/:id`
- `GET /api/search?q=<query>&status=<csv-statuses>`

Database credentials are read from `db/env/<environment>.env`, with optional `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` overrides.

## Update Triggers

Update this ADR when the API framework, database engine, spatial extension, database connection strategy, or route architecture changes.
