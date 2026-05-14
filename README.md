# Cemetery Mapping

A WebStorm-friendly Vite, React, TypeScript, and MapLibre GL JS prototype for managing church cemetery GIS records.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:5173`.

## What is included

- Interactive cemetery map with boundary, sections, and grave spaces
- Clickable grave sites with ownership, burial, and status details
- Search by deceased name, owner name, birth date, death date, burial date, section, lot, or space
- Status filters
- Ownership history timeline
- Sample in-memory data that can later move behind an API backed by PostGIS

## Suggested next backend step

Keep the front-end feature IDs stable and expose these endpoints from a backend:

- `GET /api/cemetery-map` for GeoJSON boundary, sections, and grave spaces
- `GET /api/grave-spaces/:id` for full grave details
- `GET /api/search?q=...&status=...` for indexed search
- `POST /api/ownership-events` for ownership transfers and corrections
