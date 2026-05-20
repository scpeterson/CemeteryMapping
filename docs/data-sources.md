# Data Source Register

[Documentation Home](index.md)

Use this register to track where cemetery data came from, who owns it, when it was received, how it was imported, and what confidence or limitations apply.

Every real-data import or source change should update this file and the relevant ADR.

## Cemetery and Section Geometry

| Field | Value |
| --- | --- |
| Source name | Cemetery Data Management |
| Source type | Esri File Geodatabase |
| Source path used during development | `/Users/scottpeterson/Dropbox/CemeteryDataManagement/Cemetery Data Management.gdb` |
| Feature dataset | `CemeteryDataManagement` |
| Layers imported | `Cemeteries`, `Sections` |
| Application import command | `APP_ENV=<env> npm run db:import:geodatabase -- "/path/to/Cemetery Data Management.gdb" --source-name "Cemetery Data Management"` |
| Promotion command | `APP_ENV=<env> npm run db:promote:spatial -- --batch-id <batch-uuid>` |
| Data owner | TBD |
| Date received | TBD |
| Last source edit/save date | TBD |
| Coordinate reference system | TBD; importer exports to EPSG:4326 |
| Known limitations | Blocks and lots are not used by this cemetery. Current authoritative imported layers are cemetery and sections. |
| Related ADR | [ADR 0007](adr/0007-file-geodatabase-cemetery-section-import.md) |

## Headstone GPS Coordinates and Burial Names

| Field | Value |
| --- | --- |
| Source name | TLC Gravesite Registry Geo Locations |
| Source type | Excel workbook |
| Source path used during development | `/Users/scottpeterson/Downloads/Cemetery/TLC Gravesite Registry Geo Locations 2024.09.25_SCP.xlsx` |
| Worksheet | `TELC_TABLE_12_18_2019` |
| Coordinate columns | `Latitude`, `Longitude` |
| Person columns | `Person1First` / `Person1Last` through `Person6First` / `Person6Last` |
| Year columns | `PersonNYob`, `PersonNYod` |
| Application import command | `APP_ENV=<env> npm run db:import:headstones -- "/path/to/TLC Gravesite Registry Geo Locations.xlsx"` |
| Data owner | TBD |
| Date received | TBD |
| Last source edit/save date | TBD |
| GPS collection method | TBD |
| Coordinate accuracy | TBD |
| Known limitations | Spreadsheet rows are flat and do not enforce referential integrity. Generated gravesite polygons are approximate placeholders around GPS headstone points. |
| Related ADR | [ADR 0008](adr/0008-headstone-spreadsheet-import.md) |

## Demo Seed Data

| Field | Value |
| --- | --- |
| Source name | Project demo seed |
| Source type | SQL seed fixture |
| Source path | `db/seed/demo-data.sql` |
| Application command | `APP_ENV=<dev|test|stage> npm run db:seed:demo` |
| Data owner | Project maintainers |
| Production use | Not allowed; seed command refuses `APP_ENV=prod` |
| Related ADR | [ADR 0010](adr/0010-ci-rebuild-validation.md) |

## Update Requirements

Update this register when:

- A source file path changes.
- A new source is added.
- A source owner or steward is identified.
- A source is re-exported, corrected, or superseded.
- Coordinate accuracy or collection method becomes known.
- An import command, layer mapping, or field mapping changes.
