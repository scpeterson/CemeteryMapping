# Cemetery Mapping

A WebStorm-friendly Vite, React, TypeScript, and MapLibre GL JS prototype for managing church cemetery GIS records.

## Run locally

```bash
npm install
npm run db:up
npm run db:migrate
npm run db:seed:demo
npm run dev
```

Then open `http://127.0.0.1:5173`. The development command starts the API on `http://127.0.0.1:3001` and the Vite front end on `http://127.0.0.1:5173`.

The Vite development server is pinned to port `5173` with `--strictPort` so Auth0 callback URLs do not accidentally change.

## Environments

The application supports four environments all the way through the front end, Docker database, and Liquibase:

- `DEV`
- `TEST`
- `STAGE`
- `PROD`

Frontend modes:

```bash
npm run dev          # DEV
npm run dev:test     # TEST
npm run dev:stage    # STAGE
npm run dev:prod     # PROD

npm run build:dev
npm run build:test
npm run build:stage
npm run build:prod
```

Database commands default to DEV. Set `APP_ENV` or use the convenience scripts:

```bash
npm run db:up
npm run db:up:test
npm run db:up:stage
npm run db:up:prod

APP_ENV=stage npm run db:migrate
APP_ENV=prod npm run db:status
```

If another local PostgreSQL service already uses port `5432`, create `db/env/dev.local.env` and set `POSTGRES_PORT` to an open port such as `5436`. Local env override files are ignored by git and are loaded by both Docker Compose and the API.

## What is included

- Interactive cemetery map with all active cemetery boundaries, sections, and summary grave-space geometry
- Map controls for zooming, fitting the view to all active cemetery data, identifying cemeteries at broad zoom levels, reading fractional and bar scale, and interpreting rendered layers
- Clickable grave sites that load ownership, burial, and status details on selection
- Search by deceased name, owner name, birth date, death date, burial date, section, lot, or space
- Status filters
- Ownership history timeline
- Optional non-PROD demo seed data managed by database scripts
- Spatial import staging and topology-style validation checks
- Esri File Geodatabase inspection, GeoJSON export, staging import, and cemetery/section promotion helpers
- Excel headstone coordinate import that generates gravesite polygons, headstone points, and linked burials
- Liquibase-managed PostgreSQL/PostGIS schema under `db/changelog`
- Express API backed by PostgreSQL/PostGIS

## Database

Start the local Postgres/PostGIS container and apply the Liquibase changelog:

```bash
npm run db:up
npm run db:migrate
```

More database details are in `db/README.md`.

## Architecture Decisions and Rebuild Documentation

Design decisions are documented as Architecture Decision Records in `docs/adr`. Start with `docs/adr/README.md` for the ADR index, software inventory, and ADR update rules.

A clean rebuild guide is available in `docs/rebuild.md`.

Data origins and stewardship placeholders are tracked in `docs/data-sources.md`.

The initial admin workflow order is tracked in `docs/admin-workflows.md`.

Separate Auth0 test tenant setup is documented in `docs/auth0-test-tenant.md`.

That guide also includes troubleshooting for Auth0 callback mismatches, missing API/audience configuration, SPA-to-API authorization errors, and API `401`/`403` responses.

The `docs/` folder is ready to serve with GitHub Pages using Jekyll, a custom documentation layout, sidebar navigation, and previous/next page links. In repository settings, configure Pages to deploy from the `main` branch and `/docs` folder.

Validate the documentation site locally with:

```bash
cd docs
bundle install
bundle exec jekyll build
```

Every PR that changes architecture, schema, import behavior, validation policy, deployment/rebuild behavior, or source data assumptions must add or update an ADR.

## API

The backend reads the Liquibase-managed Postgres/PostGIS schema and exposes a summary-first map flow:

- `GET /api/cemetery-map` for GeoJSON cemetery boundaries, sections, and summary grave-space geometry used by the map
- `GET /api/cemeteries/:cemeteryId/grave-spaces/:id` for full grave details fetched when a grave is selected
- `GET /api/search?q=Garcia&status=occupied,reserved` for grave, burial, owner, and date search; results return summary grave records for the map and result list
- `DELETE /api/cemeteries/:cemeteryId/grave-spaces/:id` for admin-only soft delete of a grave space
- `POST /api/cemeteries/:cemeteryId/grave-spaces/:id/restore` for admin-only restore of a soft-deleted grave space

Run the API by itself when needed:

```bash
npm run api
APP_ENV=test npm run api
API_PORT=3010 APP_ENV=stage npm run api
```

`APP_ENV` selects `db/env/<environment>.env`. Override `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, or `PGPASSWORD` to connect to a different Postgres instance.

### API Security

Read endpoints are protected by API authorization middleware. Local development and automated tests currently default to `AUTH_MODE=disabled` so the existing map UX still works before the production identity provider is selected.

For production Auth0 JWT validation, use:

```bash
AUTH_MODE=auth0
AUTH0_DOMAIN=<tenant>.auth0.com
AUTH0_AUDIENCE=<api-identifier>
```

In `AUTH_MODE=auth0`, the API validates the bearer token with Auth0 and then loads the matching `app_users` row by token subject. The local `app_users.role_name` value is the authorization source used for `reader` and `admin` checks.

For controlled integration testing behind a trusted local proxy, use `AUTH_MODE=trusted-header` and send:

- `x-cemetery-user-subject`
- `x-cemetery-user-email`
- `x-cemetery-user-role` with `reader` or `admin`

Do not expose trusted-header mode directly to the public internet.
