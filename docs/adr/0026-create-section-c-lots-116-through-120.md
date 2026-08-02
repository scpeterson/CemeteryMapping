---
---

# ADR 0026: Create Section C Lots 116 Through 120

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-02

## Context

A fourth five-lot row is needed in Section C, directly north of and bordering lots `C-111` through `C-115`. This row returns to the standard Section C dimensions of 10 feet wide by 20 feet deep.

From west to east, the new lots are `C-120`, `C-119`, `C-118`, `C-117`, and `C-116`, with `C-120` directly north of `C-115`. Lot `C-120` is part of the visible grid but cannot contain gravesites or markers.

## Decision

Create migration `277-create-trinity-c-lots-116-through-120.sql` to add Section C lots `116` through `120`.

The migration:

- uses `C-115` as its alignment and width template
- creates five lots measuring 10 feet wide by 20 feet deep
- makes the southern border of the new row coincident with the northern border of lots `C-111` through `C-115`
- places `C-120` directly north of `C-115`, followed eastward by `C-119`, `C-118`, `C-117`, and `C-116`
- marks `C-120` as `non_burial`, prohibiting gravesites and markers
- leaves `C-116` through `C-119` with standard burial use
- creates only lot records and does not create gravesites or move markers

## Consequences

The fourth new row continues the alignment and horizontal placement of the rows below without an intervening gap. C-120 remains an intentionally empty lot-grid area, while C-116 through C-119 can receive future reviewed gravesite assignments.

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

In an environment with the real Section C data, confirm that the two rows share a boundary, the new lots are 10 feet by 20 feet, their west-to-east order is `C-120` through `C-116`, and `C-120` is `non_burial`.

## Update Triggers

Update this ADR if the row's surveyed position, dimensions, alignment, order, or burial-use rules change.
