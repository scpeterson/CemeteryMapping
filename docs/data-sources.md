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
| Source path used during development | `/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/Cemetery Data Management.gdb` |
| Feature dataset | `CemeteryDataManagement` |
| Layers imported | `Cemeteries`, `Sections`, `Blocks`, `Lots` when present |
| Application import command | `APP_ENV=<env> npm run db:import:geodatabase -- "/path/to/Cemetery Data Management.gdb" --source-name "Cemetery Data Management"` |
| Full promotion command | `APP_ENV=<env> npm run db:promote:spatial -- --batch-id <batch-uuid>` |
| Focused section geometry command | `APP_ENV=<env> npm run db:promote:section-geometry -- --batch-id <batch-uuid> --facility-id 1 --sections B,G` |
| Data owner | TBD |
| Date received | TBD |
| Last source edit/save date | TBD |
| Coordinate reference system | Source geodatabase layers are Web Mercator (`EPSG:3857`); importer exports/stores EPSG:4326 |
| Known limitations | Blocks remain optional. Lots are supported and may be section-scoped when no block identifier exists. Current lot dimensions are 10 feet by 20 feet. Section geometry is required after the Trinity Section B/G refresh, so known sections should not be left with null geometry. |
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

## Section G Plot Plan

| Field | Value |
| --- | --- |
| Source name | Section G Plot Plan With Notations |
| Source type | PDF exported from Excel |
| Source path used during development | `/Users/scottpeterson/Downloads/Cemetery/Section G Plot Plan With Notations.pdf` |
| Application command | `APP_ENV=<env> npm run section-g:generate-gravesites -- --output /tmp/section-g-plot-gravesites.geojson --section-output /tmp/section-g-tight-boundary.geojson` |
| Interpretation | References to Section F in this document are typos; the plan describes Section G. Section G has no lots. Its plots are gravesites sold individually. |
| Dimensions | The small grid squares are 4 feet by 4 feet. Each plot/gravesite is 4 feet by 8 feet. |
| Survey marks | Black X marks are surveyor-set aluminum spikes used as location references; they are not gravesites or markers. |
| Generated output | GeoJSON gravesite polygons `G-001` through `G-094`, with `grave_id` preserving the PDF plot number. |
| Alignment anchor | Draft geometry keeps the west edge on the current Section G boundary and aligns the south edge of plots `G-001` and `G-024` to the south edge of gravesite `TLC-GPS-0089`/B-0089 by default. Use `--south-reference <gravesite_id>` to override that anchor. |
| Section boundary | Migrations `037-tighten-section-g-boundary.sql`, `039-align-section-g-boundary-to-gravesites.sql`, and `040-angle-section-g-boundary.sql` replace the oversized imported Section G polygon with a simplified angled boundary around the reviewed Section G plot block. The final boundary follows the PDF-style outline rather than every individual gravesite edge. |
| Gravesite import | Migration `038-add-section-g-gravesites.sql` inserts or refreshes the 94 Section G gravesites in the production `gravesites` table. Section G has no lots, so `lot_uuid` and `lot_id` are left null. |
| Deed holder import | Page 2 lists Section G plot deed holders. Migration `042-section-g-deed-holders.sql` imports populated rows into generalized ownership parties/events/rights, with one deed-holder party able to own multiple gravesite rights. The source heading says Section F, but this is interpreted as the same known Section G typo from the plan. |
| Known limitations | Gravesite geometry is fit to the current Section G west boundary, the B-0089 south-edge anchor, and plan grid. It is not survey-grade and should be reviewed against field control before promotion. |

## Historic Trinity Lot Map Scans

| Field | Value |
| --- | --- |
| Source name | Historic Trinity lot map scans |
| Source type | PNG scans of older cemetery lot maps |
| Source paths used during development | `/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png`; `/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png` |
| Application table | `historic_lot_map_gravesite_evidence` |
| Current use | Staged review evidence for gravesite-to-lot or passageway interpretation. |
| Known Section C observations | `C-0168`, `C-0167A`, `C-0167B`, `C-0166A`, and `C-0166B` appear to be in lot `70`; `C-0171B`, `C-0171A`, `C-0170`, and `C-0169` appear to be in lot `51`; `C-0172A` and `C-0172B` appear to be in the passageway between lots `29` and `51`. One lot `51` gravesite may remain unaccounted for. |
| Promoted lot geometry | Migration `060-create-trinity-c-lot-70.sql` creates reviewed Section C lot `70` from the union/perimeter of gravesites `C-0168`, `C-0167A`, `C-0167B`, `C-0166A`, and `C-0166B`, and links those gravesites to the lot. Migration `061-create-trinity-c-lot-51.sql` creates reviewed Section C lot `51` from the union/perimeter of gravesites `C-0171A`, `C-0171B`, `C-0170`, `C-0169`, and the newly mapped available gravesite `C-51-0168A`. |
| A/B gravesite suffix rule | Gravesites with `A` or `B` suffixes have been split from one original gravesite record after later evidence showed two separate gravesites. To date, those splits come from post-NHG burial evidence, shared couple headstones that span two gravesites, or both. |
| C-0166 split context | `C-0166` was created from the Geo-locations spreadsheet as one gravesite. Ruth and Charles Soergel died after NHG was published in 1997, so there is no NHG entry and there likely was no headstone there when NHG was published. A later field photo shows one shared headstone for both gravesites, so `C-0166` was split into `C-0166A` and `C-0166B`. The historic scans provide lot-context evidence. |
| C-0172 split context | `C-0172` was split because the headstone was recorded as a couple marker. James H. Simpson died in 1995 and is listed in NHG; Ruth F. Simpson died in 2011, after NHG publication, and is in a separate gravesite using the shared headstone. |
| C-0172 passageway adjustment | Migration `062-shift-trinity-c-0172-passageway-gravesites.sql` shifts `C-0172A` and `C-0172B` 2 feet north to better center them in the former 10-foot carriage passageway, clears lot assignment on those gravesites, and intentionally leaves `TLC-HS-0172` unmoved for later field verification. |
| C-29 lot geometry | Migration `063-create-trinity-c-lot-29.sql` creates reviewed Section C lot `29` 2 feet north of `C-0172A` using the same east/west span as the passageway gravesites. No gravesites are assigned to the lot yet. |
| C-10 lot geometry | Migration `064-create-trinity-c-lot-10.sql` creates reviewed Section C lot `10` directly north of lot `29`, sharing lot `29`'s northern boundary. No gravesites are assigned to the lot yet. |
| Duplicate lot-number rule | Lot numbers are not globally unique. The same lot number can exist in different cemetery areas or sections, such as `70 OC` and `70 NA`, so lot evidence must be interpreted with section or area context. |
| Known limitations | The scans are not georeferenced and are not survey-grade. North and south appear to be reversed between the two scans, so reviewers must confirm orientation before using the scans to support a lot or passageway decision. They can support deed and lot investigation, but should not directly overwrite production lot assignments or gravesite geometry without review. |
| Related ADRs | [ADR 0017](adr/0017-historic-lot-map-evidence.md), [ADR 0018](adr/0018-reviewed-section-c-lot-70.md), [ADR 0019](adr/0019-reviewed-section-c-lot-51.md), [ADR 0020](adr/0020-shift-section-c-0172-passageway-gravesites.md), [ADR 0021](adr/0021-create-section-c-lot-29.md), [ADR 0022](adr/0022-create-section-c-lot-10.md) |

## Trinity Cemetery Registry 2022

| Field | Value |
| --- | --- |
| Source name | Trinity Cemetery Registry 2022 |
| Source type | Excel workbook |
| Source path used during development | `/Users/scottpeterson/Downloads/Trinity Cemetery Registry 2022.xlsx` |
| Worksheets | `Original 2017`, `Investigated`, `Updated 2022` |
| Application import command | `APP_ENV=<env> npm run db:import:deed-registry -- "/path/to/Trinity Cemetery Registry 2022.xlsx"` |
| Three-sheet import command | `APP_ENV=<env> npm run db:import:deed-registry -- "/path/to/Trinity Cemetery Registry 2022.xlsx" --all-sheets true --source-name "Trinity Cemetery Registry 2022"` |
| Staging tables | `deed_registry_import_batches`, `deed_registry_entries`, `deed_registry_entry_allocations` |
| Worksheet interpretation | `Original 2017` is the baseline, `Investigated` preserves research rows and note-only rows, and `Updated 2022` is the investigation result. |
| Lot identifier handling | `Lot num` / `Lot Number` worksheet values are staged as candidate lot identifiers intended for future `lots.lot_id` promotion after review. |
| Known limitations | Staging and comparison only; no production promotion into lots, gravesites, generalized ownership parties/events/rights, or legacy owners yet. |

## North Hills Genealogists Trinity OCR

| Field | Value |
| --- | --- |
| Source name | North Hills Genealogists Trinity OCR |
| Source type | Searchable PDF generated from a scanned North Hills Genealogists Trinity excerpt |
| Source path used during development | `/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/FedEx Scan 2026-05-29_10-13-35.pdf` |
| Source coverage | Trinity German Evangelical Lutheran Church narrative and cemetery readings, printed pages 180-236 |
| Application import command | `APP_ENV=<env> npm run db:import:north-hills-ocr -- "/path/to/FedEx Scan 2026-05-29_10-13-35.pdf"` |
| Staging tables | `north_hills_ocr_import_batches`, `north_hills_ocr_entries`; source-only church/funeral records can also be preserved in `source_person_records` |
| Evidence link tables | `north_hills_ocr_entry_gravesite_links`, `north_hills_ocr_entry_headstone_links` |
| Review UI | Admin -> Readings; admins can link, reject, flag candidate gravesite/headstone matches, select multiple readings, mark selected readings reviewed, or send selected readings to Admin -> Bulk for a shared source note |
| Data owner | North Hills Genealogists |
| Date received | 2026-05-29 |
| Publication context | Published in 1997, Library of Congress Catalog Card #97-68576. Deaths that occurred close to or after publication may not appear in the NHG document, so absence from NHG should not be treated as strong negative evidence for those later burials. |
| Known limitations | OCR contains normal scan artifacts such as `lA` for `1A`, punctuation drift, and occasional word/name errors. The importer stages entries for review and candidate matching only. Reviewed links surface as evidence in the detail panel, but they do not overwrite burials, headstones, lots, owners, or deeds. |
| Related ADR | [ADR 0008](adr/0008-headstone-spreadsheet-import.md) |

NHG text may also mention physical relationships such as "See obelisk," common bases, foot markers, plot markers, or gap observations. Reviewed marker-to-marker references can be recorded as marker relationships in the marker detail panel. Plot marker notes should wait until a plot marker is represented as an actual marker record with a location; gap notes should remain source observations rather than operational marker relationships.

NHG pages 233-236 include church records where NHG found no matching tombstones. These people should be reviewed in `Admin -> Source People` and stored as source-only person records until later evidence supports linking them to a real burial, gravesite, or marker.

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
