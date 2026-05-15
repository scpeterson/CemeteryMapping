# Cemetery Mapping

A WebStorm-friendly Vite, React, TypeScript, and MapLibre GL JS prototype for managing church cemetery GIS records.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:5173`.

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

- Interactive cemetery map with boundary, sections, and grave spaces
- Clickable grave sites with ownership, burial, and status details
- Search by deceased name, owner name, birth date, death date, burial date, section, lot, or space
- Status filters
- Ownership history timeline
- Sample in-memory data that can later move behind an API backed by PostGIS
- Liquibase-managed PostgreSQL/PostGIS schema under `db/changelog`

## Database

Start the local Postgres/PostGIS container and apply the Liquibase changelog:

```bash
npm run db:up
npm run db:migrate
```

More database details are in `db/README.md`.

## Suggested next backend step

Keep the front-end feature IDs stable and expose these endpoints from a backend:

- `GET /api/cemetery-map` for GeoJSON boundary, sections, and grave spaces
- `GET /api/grave-spaces/:id` for full grave details
- `GET /api/search?q=...&status=...` for indexed search
- `POST /api/ownership-events` for ownership transfers and corrections
