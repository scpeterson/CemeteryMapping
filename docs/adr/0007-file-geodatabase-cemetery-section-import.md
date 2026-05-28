---
---

# ADR 0007: Import Cemetery, Section, Block, and Lot Geometry from an Esri File Geodatabase

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #9, PR #10

## Context

The first authoritative cemetery boundary, section, and lot geometries are stored in an Esri File Geodatabase. The application needs to inspect that source, import cemetery hierarchy layers, validate them, and promote them into PostGIS.

## Decision

Use GDAL/OGR command-line tools to inspect and export File Geodatabase layers, then import recognized layers into staging.

Commands:

```bash
npm run geodatabase:inspect -- /path/to/source.gdb
npm run geodatabase:export -- /path/to/source.gdb Cemeteries /tmp/cemeteries.geojson
npm run db:import:geodatabase -- /path/to/source.gdb --source-name "Cemetery Data Management"
```

Recognized layers:

- `Cemeteries`
- `Sections`
- `Blocks`
- `Lots`
- `Memorials`

Current real source data may omit blocks. Lots can be promoted as section-scoped records when no block identifier is present.

## Rationale

GDAL/OGR is the standard open geospatial toolchain for reading File Geodatabases and exporting normalized GeoJSON. Importing to staging first preserves source properties and allows validation before production promotion.

## Data Origins

Known source:

| Field | Value |
| --- | --- |
| Source type | Esri File Geodatabase |
| Local path used during development | `/Users/scottpeterson/Dropbox/CemeteryDataManagement/Cemetery Data Management.gdb` |
| Feature dataset | `CemeteryDataManagement` |
| Layers used | `Cemeteries`, `Sections`, `Blocks`, `Lots` when present |
| Responsible data owner | TBD |
| Date received or last saved | TBD |
| Coordinate reference system | Source geodatabase layers are Web Mercator (`EPSG:3857`); importer declares the source CRS and normalizes output to EPSG:4326 |
| Stewardship notes | Blocks are optional; lots are 10 feet by 20 feet and may be section-scoped |

## Consequences

The production `cemeteries`, `sections`, `blocks`, and `lots` tables can come from promoted FileGDB staging batches. Blocks remain optional. Lots are now part of the active hierarchy and render between section boundaries and gravesites on the map.

Future grave polygon imports should use an actual gravesite source layer if one becomes available rather than treating headstone points as surveyed grave polygons.

## Rebuild Notes

Inspect the FileGDB:

```bash
npm run geodatabase:inspect -- "/path/to/Cemetery Data Management.gdb"
```

Import to staging:

```bash
APP_ENV=test npm run db:import:geodatabase -- "/path/to/Cemetery Data Management.gdb" --source-name "Cemetery Data Management"
```

Validate:

```bash
APP_ENV=test npm run db:validate:spatial
```

Promote:

```bash
APP_ENV=test npm run db:promote:spatial -- --batch-id <batch-uuid>
```

If the batch UUID is not visible in the import output, query `spatial_import_batches` in the target environment:

```sql
SELECT id, source_name, source_path, imported_at, status
FROM spatial_import_batches
ORDER BY imported_at DESC;
```

## Update Triggers

Update this ADR when the source geodatabase path, data owner, feature dataset, layer mapping, coordinate system, or promotion behavior changes.
