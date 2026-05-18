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

## What is included

- Interactive cemetery map with boundary, sections, and summary grave-space geometry
- Clickable grave sites that load ownership, burial, and status details on selection
- Search by deceased name, owner name, birth date, death date, burial date, section, lot, or space
- Status filters
- Ownership history timeline
- Optional non-PROD demo seed data managed by database scripts
- Spatial import staging and topology-style validation checks
- Esri File Geodatabase inspection, GeoJSON export, and staging import helpers
- Liquibase-managed PostgreSQL/PostGIS schema under `db/changelog`
- Express API backed by PostgreSQL/PostGIS

## Database

Start the local Postgres/PostGIS container and apply the Liquibase changelog:

```bash
npm run db:up
npm run db:migrate
```

More database details are in `db/README.md`.

## API

The backend reads the Liquibase-managed Postgres/PostGIS schema and exposes a summary-first map flow:

- `GET /api/cemetery-map` for GeoJSON boundary, sections, and summary grave-space geometry used by the map
- `GET /api/grave-spaces/:id` for full grave details fetched when a grave is selected
- `GET /api/search?q=Garcia&status=occupied,reserved` for grave, burial, owner, and date search; results return summary grave records for the map and result list

Run the API by itself when needed:

```bash
npm run api
APP_ENV=test npm run api
API_PORT=3010 APP_ENV=stage npm run api
```

`APP_ENV` selects `db/env/<environment>.env`. Override `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, or `PGPASSWORD` to connect to a different Postgres instance.
