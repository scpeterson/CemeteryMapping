---
---

# ADR 0022: Create Reviewed Section C Lot 10

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-06-09

## Context

Section C lot `29` has been represented as a reviewed lot north of the former carriage passageway. Lot `10` sits directly north of lot `29`, with lot `29`'s northern boundary coincident with lot `10`'s southern boundary.

There are not yet any mapped gravesites assigned to lot `10`.

## Decision

Create migration `064-create-trinity-c-lot-10.sql` to add Trinity Section C lot `10` as `C-10`.

The migration:

- anchors lot `10` to reviewed lot `29`
- uses the same east and west edges as lot `29`
- sets lot `10`'s south edge to lot `29`'s north edge
- gives the lot a 20-foot north-south height to match the reviewed Section C lot footprint
- creates only a lot record and does not assign gravesites or move markers

## Consequences

Section C lot `10` becomes visible on the map as a lot polygon without gravesites.

Future gravesite evidence for lot `10` can be added later without changing lot `29`.

## Rebuild And Validation

Run:

```bash
npm run test:server
npm run lint
npm run build
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:migrate
```

In an environment with the real Section C data, confirm `C-10` shares its southern boundary with the northern boundary of `C-29` and has no linked gravesites.

## Update Triggers

Update this ADR if lot `10` receives reviewed gravesite assignments, if its measured footprint changes, or if lot `29` geometry changes.
