---
---

# ADR 0008: Generate Gravesites and Headstones from Headstone GPS Spreadsheet Rows

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #11, PR #12, PR #13

## Context

The cemetery has an Excel spreadsheet containing GPS coordinates for headstones. Each spreadsheet row represents one GPS location and can list one to six people. The current database needs a usable gravesite geometry for the map, a physical marker/headstone point for condition tracking, and linked burial records.

## Decision

Use `scripts/db-import-headstones-xlsx.mjs` to import the spreadsheet.

For each row with coordinates and at least one person, the importer creates or updates:

1. One generated 10 foot by 20 foot `lots` polygon.
2. One generated `gravesites` polygon inside that lot.
3. One `headstones` point at the GPS coordinate.
4. One or more `burials`.
5. `headstone_burials` join rows linking the headstone to each burial.

Generated lot polygon dimensions:

- 20 feet east-west
- 10 feet north-south
- Centered on the headstone GPS coordinate

Generated grave polygon dimensions:

- 4 feet east-west
- 10 feet north-south
- Centered on the headstone GPS coordinate

Headstone marker geometry:

- PostGIS `Point` in EPSG:4326
- Latitude and longitude stored as numeric columns and as geometry

## Rationale

The spreadsheet is a flat file without referential integrity, but it is enough to produce useful map placeholders and burial/headstone links. The generated lot polygon gives the map and API a stable cemetery/section/lot/gravesite hierarchy. The headstone point preserves the actual GPS location separately from the approximate grave box.

The 10 foot by 20 foot lot and 10 foot by 4 foot grave rectangles are pragmatic placeholders. Five 4 foot wide gravesites can fit across the 20 foot lot length. The lot's long dimension runs east-west so it appears left-to-right on the current map. For Trinity sections A through D, generated gravesite rectangles use the headstone GPS coordinate as the center of the left/west short edge and extend 10 feet east from that marker point. Other generated gravesites remain centered on the coordinate until section-specific placement rules are known.

## Data Origins

Known source:

| Field | Value |
| --- | --- |
| Source type | Excel workbook |
| Local path used during development | `/Users/scottpeterson/Downloads/Cemetery/TLC Gravesite Registry Geo Locations 2024.09.25_SCP.xlsx` |
| Worksheet | `TELC_TABLE_12_18_2019` |
| Coordinate columns | `Latitude`, `Longitude` |
| People columns | `Person1...Person6` |
| Year fields | `PersonNYob`, `PersonNYod`; imported as `YYYY-01-01` |
| Headstone data owner | TBD |
| Original collection method | TBD |
| Coordinate accuracy | TBD |
| Last source update | TBD |

Source naming notes:

- `Nhg` means `North Hills Genealogists`.
- `Tlc` means `Trinity Lutheran Church`.
- The source previously had a typo `Logitude`; the workbook used by the importer has `Longitude`.

## Consequences

Generated lot and grave boxes are not surveyed polygons. They can overlap and should be treated as approximate until better spatial data exists.

The database enforces a maximum of five active gravesites per lot. Lot-level ownership is represented by reusable owner parties and ownership events, with event types for deeds, sales, gifts, church council action, corrections, and releases.

The importer replaces burial rows for generated gravesites when rerun. This makes the spreadsheet import idempotent for the generated `TLC-GPS-*` records, but maintainers should not manually edit those generated burial rows without planning how to preserve edits.

## Rebuild Notes

Apply the headstone schema before importing:

```bash
APP_ENV=test npm run db:migrate
```

Dry run:

```bash
APP_ENV=test npm run db:import:headstones -- "/path/to/TLC Gravesite Registry Geo Locations.xlsx" --dry-run
```

Real import:

```bash
APP_ENV=test npm run db:import:headstones -- "/path/to/TLC Gravesite Registry Geo Locations.xlsx"
```

Validate:

```bash
APP_ENV=test npm run db:validate:spatial
```

Development import results on 2026-05-19:

- 536 generated lots
- 536 generated gravesites
- 536 headstones
- 671 burials
- 671 headstone-to-burial links
- 521 gravesites linked to sections
- 536 gravesites linked to lots
- 15 section-link warnings
- 0 generated gravesite spatial errors

## Update Triggers

Update this ADR when the spreadsheet columns change, source workbook changes, import ID strategy changes, generated lot or grave dimensions change, condition defaults change, or the importer stops replacing generated burial rows.
