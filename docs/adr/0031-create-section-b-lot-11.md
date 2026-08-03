---
---

# ADR 0031: Create Section B Lot 11

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

Trinity Section B needs lot `B-11` directly west of `B-8`. It has the same size and shape as `B-8`, and its eastern edge is coincident with `B-8`'s western edge. Trinity does not use blocks, so the new lot is scoped directly to Section B.

## Decision

Create migration `282-create-trinity-b-lot-11.sql` to add Section B lot `11` as `B-11`.

The migration:

- copies the recorded 16.36-foot width and 16-foot length from `B-8`
- copies `B-8`'s north and south boundaries exactly
- places `B-11` directly west of `B-8`
- makes `B-11`'s eastern edge coincident with `B-8`'s western edge
- scopes the lot directly to Section B with no block identifiers
- assigns standard burial use
- creates only the lot and does not assign gravesites or move markers

## Consequences

`B-11` becomes visible as an estimated operational lot beside `B-8`. Existing gravesites and markers remain unchanged.

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

In an environment with Trinity data, confirm that `B-11` and `B-8` share their complete north/south boundary, have matching dimensions, and both have null block identifiers.

## Update Triggers

Update this ADR if the lot's surveyed position, dimensions, alignment, burial-use status, or identifier changes.
