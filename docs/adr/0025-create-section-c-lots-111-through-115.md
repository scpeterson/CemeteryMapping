---
---

# ADR 0025: Create Section C Lots 111 Through 115

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-02

## Context

A third five-lot row is needed in Section C, separated by a 6-foot aisle from lots `C-106` through `C-110`. The lots continue the smaller 10-foot-wide-by-12-foot-deep format, supporting up to three 4-foot-wide gravesites when burial use is allowed.

From west to east, the new lots are `C-115`, `C-114`, `C-113`, `C-112`, and `C-111`, with `C-115` north of `C-110`. Lot `C-115` is part of the visible grid but cannot contain gravesites or markers.

## Decision

Create migration `276-create-trinity-c-lots-111-through-115.sql` to add Section C lots `111` through `115`.

The migration:

- uses `C-110` as its alignment and width template
- creates five lots measuring 10 feet wide by 12 feet deep
- places the new row 6 feet north of lots `C-106` through `C-110` using a geodesic northward offset
- places `C-115` north of `C-110`, followed eastward by `C-114`, `C-113`, `C-112`, and `C-111`
- marks `C-115` as `non_burial`, prohibiting gravesites and markers
- leaves `C-111` through `C-114` with standard burial use
- creates only lot records and does not create gravesites or move markers

## Consequences

The third new row continues the alignment and horizontal placement of the rows below, separated by a 6-foot aisle. C-115 remains an intentionally empty lot-grid area, while C-111 through C-114 can receive future reviewed gravesite assignments.

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

In an environment with the real Section C data, confirm the 6-foot north gap, 10-foot-by-12-foot dimensions, west-to-east order `C-115` through `C-111`, and `non_burial` restriction on `C-115`.

## Update Triggers

Update this ADR if the row's surveyed position, dimensions, alignment, order, aisle width, or burial-use rules change.
