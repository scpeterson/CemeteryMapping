# Cemetery Mapping

A WebStorm-friendly Vite, React, TypeScript, and MapLibre GL JS prototype for managing church cemetery GIS records.

## Run locally

For a beginner-friendly setup guide with Mac and Windows notes, see `docs/getting-started.md`.

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

Promotion between environments is documented in [Operator Workflows](docs/operator-workflows.md#environment-promotion-workflow). In short: implement in DEV, validate through PR/CI in TEST, rehearse production-like deployment in STAGE, then promote to PROD only after backups, smoke tests, and a rollback or forward-fix plan are ready.

If another local PostgreSQL service already uses port `5432`, create `db/env/dev.local.env` and set `POSTGRES_PORT` to an open port such as `5436`. Local env override files are ignored by git and are loaded by both Docker Compose and the API.

## What is included

- Interactive cemetery map with all active cemetery boundaries, sections, and summary grave-space geometry
- Map controls for zooming, fitting the view to all active cemetery data, identifying cemeteries at broad zoom levels, reading fractional and bar scale, and interpreting rendered layers
- Clickable grave sites that load ownership, burial, and status details on selection
- Search by deceased name, owner name, birth date, death date, burial date, cemetery name, section, lot name, lot ID, or space
- Status filters
- Ownership history timeline
- Optional non-PROD demo seed data managed by database scripts
- Spatial import staging and topology-style validation checks
- Esri File Geodatabase inspection, GeoJSON export, staging import, and cemetery/section promotion helpers
- Excel headstone coordinate import that generates gravesite polygons, headstone points, and linked burials
- Admin-only cemetery record editor with searchable cemetery, section, and lot pickers for cemetery names/notes, section names and alternate names, and lot names
- Admin data quality dashboard with cemetery-scoped cleanup counts for staged readings, marker/gravesite links, partial dates, veterans, photos, and open maintenance work
- Admin bulk edit tools for carefully scoped marker lookup updates, gravesite lot assignment, and multi-entry North Hills reading cleanup
- Admin source-only person review for church, funeral-home, and source records that do not yet have known gravesites or markers
- Admin deed evidence review with deed investigation cases, linked evidence rows, repeatable recommended actions, Council decision tracking, affidavit status, and final outcomes
- Liquibase-managed PostgreSQL/PostGIS schema under `db/changelog`
- Express API backed by PostgreSQL/PostGIS

## Database

Start the local Postgres/PostGIS container and apply the Liquibase changelog:

```bash
npm run db:up
npm run db:migrate
```

The API verifies the current Liquibase changeset before it begins listening and exits with migration guidance when the database schema is out of date.

More database details are in `db/README.md`.

## Architecture Decisions and Rebuild Documentation

Design decisions are documented as Architecture Decision Records in `docs/adr`. Start with `docs/adr/README.md` for the ADR index, software inventory, and ADR update rules.

A beginner-friendly setup guide is available in `docs/getting-started.md`.

A clean rebuild guide is available in `docs/rebuild.md`.

Data origins and stewardship placeholders are tracked in `docs/data-sources.md`.

The initial admin workflow order is tracked in `docs/admin-workflows.md`.

Practical click-by-click and command-oriented workflows are tracked in `docs/operator-workflows.md`.

Release history is tracked in `CHANGELOG.md`; release strategy is documented in `docs/adr/0016-versioned-releases.md`.

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
- `GET /api/version` for application version, git SHA, build time, and environment metadata
- `GET /api/health` for API, database, and version health metadata
- `GET /api/cemeteries/:cemeteryId/grave-spaces/:id` for full grave details fetched when a grave is selected
- `GET /api/search?q=Garcia&status=occupied,reserved` for grave, burial, owner, and date search; results return summary grave records for the map and result list
- `GET /api/admin/cemetery-records` for admin-only cemetery, section, and lot text records
- `PUT /api/admin/cemetery-records/cemeteries/:id`, `/sections/:id`, and `/lots/:id` for admin-only text updates
- `GET /api/admin/deed-registry-review` for staged deed registry evidence review
- `GET` and `POST /api/admin/deed-investigation-cases` plus case `PUT`, evidence-link, and action endpoints for admin-only deed investigation documentation
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

In `AUTH_MODE=auth0`, the API validates the bearer token with Auth0 and then loads the matching `app_users` row by token subject. The local `app_users.role_name` value is the authorization source used for `reader`, `power-user`, `cemetery-admin`, and `admin` checks.

Auth0 API permissions must be configured in Auth0 manually. The API should include `read:cemetery`, `write:cemetery`, `read:deeds`, and `write:deeds`; assign the deed permissions to `power-user`, `cemetery-admin`, and `admin`, then have affected users sign out and back in so their access tokens are refreshed.

To configure those Auth0 API permissions and role assignments through the Auth0 Management API, run the environment-aware setup script with the target tenant values:

```bash
AUTH0_DOMAIN=<tenant>.auth0.com \
AUTH0_AUDIENCE=<api-identifier> \
AUTH0_MANAGEMENT_CLIENT_ID=<machine-to-machine-client-id> \
AUTH0_MANAGEMENT_CLIENT_SECRET=<machine-to-machine-client-secret> \
npm run auth0:configure
```

Use the same script for each environment by changing the Auth0 tenant, audience, and Management API credentials. The machine-to-machine client needs `read:resource_servers`, `update:resource_servers`, `read:roles`, `create:roles`, and `update:roles`.

The Admin UI can find or create Auth0 database-connection users before saving the local application role when these server-only Management API settings are configured:

```bash
AUTH0_MANAGEMENT_CLIENT_ID=<machine-to-machine-client-id>
AUTH0_MANAGEMENT_CLIENT_SECRET=<machine-to-machine-client-secret>
AUTH0_MANAGEMENT_CONNECTION=Username-Password-Authentication
AUTH0_PASSWORD_RESET_CLIENT_ID=<spa-client-id>
```

The Management API client needs `read:users` and `create:users`. `AUTH0_PASSWORD_RESET_CLIENT_ID` is optional; when present, newly created Auth0 database users also receive Auth0's password reset email so they can set their own password. Auth0 remains the identity provider; the application database remains the source of truth for application roles and active/inactive access.

Admins can deactivate or reactivate users in the Admin UI. Deactivation sets the local `app_users.is_active` flag to `false`, which blocks application access after token validation without deleting the Auth0 account or the local mapping.

For controlled integration testing behind a trusted local proxy, use `AUTH_MODE=trusted-header` and send:

- `x-cemetery-user-subject`
- `x-cemetery-user-email`
- `x-cemetery-user-role` with `reader`, `power-user`, `cemetery-admin`, or `admin`

Do not expose trusted-header mode directly to the public internet.
