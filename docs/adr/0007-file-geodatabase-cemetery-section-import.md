# ADR 0007: Import Cemetery and Section Geometry from an Esri File Geodatabase

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #9, PR #10

## Context

The first authoritative cemetery boundary and section geometries are stored in an Esri File Geodatabase. The application needs to inspect that source, import cemetery and section layers, validate them, and promote them into PostGIS.

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

Current real source data only uses cemetery and section geometry for this cemetery.

## Rationale

GDAL/OGR is the standard open geospatial toolchain for reading File Geodatabases and exporting normalized GeoJSON. Importing to staging first preserves source properties and allows validation before production promotion.

## Data Origins

Known source:

| Field | Value |
| --- | --- |
| Source type | Esri File Geodatabase |
| Local path used during development | `/Users/scottpeterson/Dropbox/CemeteryDataManagement/Cemetery Data Management.gdb` |
| Feature dataset | `CemeteryDataManagement` |
| Layers used | `Cemeteries`, `Sections` |
| Responsible data owner | TBD |
| Date received or last saved | TBD |
| Coordinate reference system | Determined by GDAL during export; importer normalizes output to EPSG:4326 |
| Stewardship notes | Blocks and lots are not used by this cemetery and should remain blank |

## Consequences

The production `cemeteries` and `sections` tables come from promoted FileGDB staging batches. Blocks and lots remain optional and unused for Trinity Lutheran Church Cemetery.

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

## Update Triggers

Update this ADR when the source geodatabase path, data owner, feature dataset, layer mapping, coordinate system, or promotion behavior changes.
