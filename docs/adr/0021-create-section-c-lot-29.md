---
---

# ADR 0021: Create Reviewed Section C Lot 29

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-06-09

## Context

`C-0172A` and `C-0172B` sit in the former Section C carriage passageway between lots `29` and `51`. After shifting the passageway gravesites north, lot `29` can be represented as a reviewed lot north of that passageway.

There are not yet any mapped gravesites assigned to lot `29`.

## Decision

Create migration `063-create-trinity-c-lot-29.sql` to add Trinity Section C lot `29` as `C-29`.

The migration:

- anchors lot `29` to the reviewed `C-0172A` geometry
- sets lot `29`'s south edge 2 feet north of `C-0172A`'s north edge
- uses the same east and west edges as the reviewed passageway gravesites
- gives the lot a 20-foot north-south height to match the reviewed Section C lot stack footprint
- creates only a lot record and does not assign gravesites or move markers

## Consequences

Section C lot `29` becomes visible on the map as a lot polygon without gravesites.

Future gravesite evidence for lot `29` can be added later without changing the passageway gravesite records.

## Rebuild And Validation

Run:

```bash
npm run test:server
npm run lint
npm run build
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:migrate
```

In an environment with the real Section C data, confirm `C-29` appears 2 feet north of `C-0172A` and has no linked gravesites.

## Update Triggers

Update this ADR if lot `29` receives reviewed gravesite assignments, if its measured footprint changes, or if the passageway geometry changes again.
