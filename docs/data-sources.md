---
---

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
| Layers imported | `Cemeteries`, `Sections`, `Blocks`, `Lots` when present |
| Application import command | `APP_ENV=<env> npm run db:import:geodatabase -- "/path/to/Cemetery Data Management.gdb" --source-name "Cemetery Data Management"` |
| Promotion command | `APP_ENV=<env> npm run db:promote:spatial -- --batch-id <batch-uuid>` |
| Data owner | TBD |
| Date received | TBD |
| Last source edit/save date | TBD |
| Coordinate reference system | Source geodatabase layers are Web Mercator (`EPSG:3857`); importer exports/stores EPSG:4326 |
| Known limitations | Blocks remain optional. Lots are supported and may be section-scoped when no block identifier exists. Current lot dimensions are 10 feet by 20 feet. |
| Related ADR | [ADR 0007](adr/0007-file-geodatabase-cemetery-section-import.md) |

## PASDA Imagery

| Field | Value |
| --- | --- |
| Source name | pasda/AlleghenyCountyImagery2017 |
| Source type | ArcGIS Map Service |
| Service URL | `https://imagery.pasda.psu.edu/arcgis/rest/services/pasda/AlleghenyCountyImagery2017/MapServer` |
| Native coordinate reference system | NAD83 (`EPSG:4269`) |
| Application map request | ArcGIS MapServer `export` rendered as one MapLibre image source for the current map viewport, with `bboxSR=3857`, `imageSR=3857`, and Esri datum transformation `108190` (`WGS_1984_(ITRF00)_To_NAD_1983`, inverse) for NAD83 imagery; the image refreshes after map movement or resize |
| Layer request | Parent mosaic layer `layers=show:1` (`Allegheny County Imagery 2017_3in`) |
| Known limitations | The service is not cached. The app requests dynamic Web Mercator export images for the visible viewport, while ArcGIS Pro consumes the ArcGIS Map Service natively. |

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
| Source naming notes | `Nhg` columns refer to `North Hills Genealogists`; `Tlc` columns refer to `Trinity Lutheran Church`. |
| Data owner | TBD |
| Date received | TBD |
| Last source edit/save date | TBD |
| GPS collection method | TBD |
| Coordinate accuracy | TBD |
| Known limitations | Spreadsheet rows are flat and do not enforce referential integrity. Generated lot and gravesite polygons are approximate placeholders around GPS headstone points. |
| Related ADR | [ADR 0008](adr/0008-headstone-spreadsheet-import.md) |

## North Hills Genealogists Trinity OCR

| Field | Value |
| --- | --- |
| Source name | North Hills Genealogists Trinity OCR |
| Source type | Searchable PDF generated from a scanned North Hills Genealogists Trinity excerpt |
| Source path used during development | `/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/FedEx Scan 2026-05-29_10-13-35.pdf` |
| Source coverage | Trinity German Evangelical Lutheran Church narrative and cemetery readings, printed pages 180-236 |
| Application import command | `APP_ENV=<env> npm run db:import:north-hills-ocr -- "/path/to/FedEx Scan 2026-05-29_10-13-35.pdf"` |
| Staging tables | `north_hills_ocr_import_batches`, `north_hills_ocr_entries` |
| Evidence link tables | `north_hills_ocr_entry_gravesite_links`, `north_hills_ocr_entry_headstone_links` |
| Review UI | Admin -> Readings; admins can link, reject, or flag candidate gravesite/headstone matches |
| Data owner | North Hills Genealogists |
| Date received | 2026-05-29 |
| Known limitations | OCR contains normal scan artifacts such as `lA` for `1A`, punctuation drift, and occasional word/name errors. The importer stages entries for review and candidate matching only. Reviewed links surface as evidence in the detail panel, but they do not overwrite burials, headstones, lots, owners, or deeds. |
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
| Known limitations | Demo sections, lots, and gravesites are seeded for local UI testing. Demo blocks are intentionally omitted because block records remain optional. |
| Related ADR | [ADR 0010](adr/0010-ci-rebuild-validation.md) |

## Update Requirements

Update this register when:

- A source file path changes.
- A new source is added.
- A source owner or steward is identified.
- A source is re-exported, corrected, or superseded.
- Coordinate accuracy or collection method becomes known.
- An import command, layer mapping, or field mapping changes.
