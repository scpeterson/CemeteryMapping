---
---

# ADR 0023: Create Section C Lots 101 Through 105

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-02

## Context

Trinity Section C lots use a 10-foot east-west width and a 20-foot north-south length, supporting up to five 4-foot-by-10-foot gravesites when burial use is allowed. A new five-lot row is needed north of the existing row ending at lot `C-100`. Its final placement leaves a 6-foot aisle after the complete group of newly created lots was shifted 2 feet south.

Lot `C-105` is north of `C-100`, with the new row shifted 2 feet west. The remaining new lots extend east from `C-105` in descending identifier order: `C-104`, `C-103`, `C-102`, and `C-101`.

Like `C-100`, lot `C-105` is part of the visible lot grid but cannot contain gravesites or markers.

## Decision

Create migration `274-create-trinity-c-lots-101-through-105.sql` to add Section C lots `101` through `105`.

The migration:

- uses the WGS-aligned boundaries of `C-100` as the row template so the new lots match the established Section C grid alignment
- retains the established 10-foot-by-20-foot lot dimensions recorded for Section C lots
- places the south edge of `C-105` 6 feet north of the north edge of `C-100`, using a geodesic northward offset
- shifts the complete five-lot row 2 feet west using a geodesic westward offset
- places `C-104`, `C-103`, `C-102`, and `C-101` east of `C-105` in 10-foot increments
- marks `C-105` as `non_burial`, prohibiting gravesites and markers
- leaves `C-101` through `C-104` with standard burial use
- creates only lot records and does not assign gravesites or move markers

## Consequences

The new row becomes visible on the map with a consistent Section C footprint and aisle. `C-105` remains an intentionally empty lot-grid area, while `C-101` through `C-104` can receive future reviewed gravesite assignments.

## Rebuild And Validation

Run:

```bash
npm run test:server
npm run lint
npm run build
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:migrate
APP_ENV=test npm run db:validate:spatial
```

In an environment with the real Section C data, confirm the 6-foot north gap and 2-foot west offset between `C-100` and `C-105`, the eastward order `C-105` through `C-101`, and the `non_burial` restriction on `C-105`.

## Update Triggers

Update this ADR if the new row's surveyed position or dimensions change, the aisle width changes, or the burial-use restriction on `C-105` changes.
