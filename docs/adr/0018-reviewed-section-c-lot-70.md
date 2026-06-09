---
---

# ADR 0018: Create Reviewed Section C Lot 70 from Gravesite Perimeter

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-06-09

## Context

ADR 0017 added staged historic lot map evidence for Trinity Section C. That evidence, together with the reviewed gravesite geometry, supports one known lot assignment: Section C lot `70` is composed of gravesites `C-0168`, `C-0167A`, `C-0167B`, `C-0166A`, and `C-0166B`.

The historic scans are not survey-grade and have an orientation caveat, but this lot can be represented from already reviewed gravesite polygons rather than by tracing the scan directly. Its lot geometry should therefore be the perimeter of those five gravesites.

## Decision

Create migration `060-create-trinity-c-lot-70.sql` to insert or update Trinity Section C lot `70` as `C-70`.

The migration:

- requires all five source gravesites to exist before creating the lot
- builds the lot geometry from the union of the five gravesite polygons
- links those gravesites back to the lot through `lot_uuid` and `lot_id = '70'`
- leaves the remaining historic lot map evidence staged for future review

Render lot polygons above gravesites on the map with transparent fill, orange outline, and a section-lot label such as `C-70`.

## Consequences

Section C lot `70` becomes a real production lot record that can support later deed registry promotion and ownership-right review.

The migration avoids creating a partial lot in environments where all five real-data gravesites are not present.

The lot boundary remains derived from reviewed gravesite geometry, not from survey-grade lot measurement.

## Rebuild And Validation

Run:

```bash
npm run test:server
npm run lint
npm run build
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:migrate
```

In an environment with the real Section C Soergel gravesites, confirm lot `C-70` exists and covers the five source gravesites.

## Update Triggers

Update this ADR if Section C lot `70` geometry changes, if additional reviewed historic lots are promoted, if lot labels change, or if lot geometry becomes survey-derived rather than gravesite-derived.
