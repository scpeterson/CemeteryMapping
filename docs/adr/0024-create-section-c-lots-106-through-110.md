---
---

# ADR 0024: Create Section C Lots 106 Through 110

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-02

## Context

The next Section C row north of lots `C-101` through `C-105` uses smaller lots. Each lot remains 10 feet wide but is only 12 feet deep, supporting up to three 4-foot-wide gravesites.

Five lots are needed with no aisle between the rows. From west to east they are `C-110`, `C-109`, `C-108`, `C-107`, and `C-106`, with `C-110` directly north of `C-105`.

## Decision

Create migration `275-create-trinity-c-lots-106-through-110.sql` to add Section C lots `106` through `110`.

The migration:

- uses `C-105` as its alignment and width template
- creates five standard-burial lots measuring 10 feet wide by 12 feet deep
- makes the southern border of the new row coincident with the northern border of lots `C-101` through `C-105`
- places `C-110` directly north of `C-105`, followed eastward by `C-109`, `C-108`, `C-107`, and `C-106`
- creates only lot records and does not create gravesites or move markers

## Consequences

The second new row continues the alignment and horizontal placement of the row below without an intervening gap. Each lot records the smaller three-gravesite capacity footprint through its 10-foot-by-12-foot dimensions.

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

In an environment with the real Section C data, confirm that the two rows share a boundary, the new lots are 10 feet by 12 feet, and their west-to-east order is `C-110` through `C-106`.

## Update Triggers

Update this ADR if the row's surveyed position, dimensions, alignment, order, or burial-use rules change.
