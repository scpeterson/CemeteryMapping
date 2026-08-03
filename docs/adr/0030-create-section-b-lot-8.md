---
---

# ADR 0030: Create Section B Lot 8

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

Trinity Section B needs a reviewed lot `B-8`. Its footprint matches the non-standard Section C lot `C-42A`, its eastern edge aligns with the eastern edge of `A-1`, and its southern edge sits 3 feet south of gravesite `B-0095` (`TLC-GPS-0095`). Trinity does not use blocks, so the new lot is scoped directly to Section B.

## Decision

Create migration `281-create-trinity-b-lot-8.sql` to add Section B lot `8` as `B-8`.

The migration:

- copies the recorded 16.36-foot width and 16-foot length from `C-42A`
- uses `C-42A` as the east-west footprint template
- aligns the lot's eastern edge exactly with the eastern edge of `A-1`
- places the lot's southern edge 3 feet south of the southern edge of gravesite `B-0095` using a geodesic offset
- scopes the lot directly to Section B with no block identifiers
- assigns standard burial use
- creates only the lot and does not assign gravesites or move markers

## Consequences

`B-8` becomes visible as an estimated operational lot at the reviewed position. Existing gravesites and markers remain unchanged.

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

In an environment with Trinity data, confirm the 3-foot southern offset from `B-0095`, eastern-edge alignment with `A-1`, dimensions matching `C-42A`, and null block identifiers.

## Update Triggers

Update this ADR if the lot's surveyed position, dimensions, anchor interpretation, burial-use status, or identifier changes.
