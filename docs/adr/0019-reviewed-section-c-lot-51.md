---
---

# ADR 0019: Create Reviewed Section C Lot 51 with Missing Gravesite

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-06-09

## Context

ADR 0017 preserved historic lot map evidence indicating that Trinity Section C lot `51` includes gravesites `C-0171A`, `C-0171B`, `C-0170`, and `C-0169`, with one additional unaccounted gravesite. The reviewed map geometry shows that the unaccounted gravesite is the open 4-foot by 10-foot space immediately south of `C-0169` and immediately north of lot `C-70` gravesite `C-0168`.

## Decision

Create migration `061-create-trinity-c-lot-51.sql` to add the missing available gravesite as `C-51-0168A` and to insert or update Trinity Section C lot `51` as `C-51`.

The migration:

- creates the available gravesite from the exact east and west edges of `C-0169`
- sets the available gravesite's north edge to `C-0169`'s south edge
- sets the available gravesite's south edge to `C-0168`'s north edge
- links `C-0171A`, `C-0171B`, `C-0170`, `C-0169`, and the new available gravesite to lot `51`
- builds the lot geometry from the union of those five gravesite polygons

## Consequences

Section C lot `51` becomes a production lot record that can support later deed registry promotion and ownership-right review.

The missing gravesite is represented as an available mapped space without burial or marker records.

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

In an environment with the real Section C gravesites, confirm lot `C-51` exists and covers the five source gravesites.

## Update Triggers

Update this ADR if Section C lot `51` geometry changes, if the missing gravesite receives a better source identifier, if additional reviewed historic lots are promoted, or if lot geometry becomes survey-derived rather than gravesite-derived.
