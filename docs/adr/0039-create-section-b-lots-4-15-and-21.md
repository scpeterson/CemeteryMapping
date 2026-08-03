---
---

# ADR 0039: Create Section B Lots 4, 15, and 21

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

Trinity Section B needs a three-lot row north of lots `B-14` and `B-5`. Eastern lot `B-4` must border `B-5` to its south. Lot `B-15` must sit immediately west of `B-4` and border `B-14` to its south. Lot `B-21` must sit immediately west of `B-15` with coincident east and west edges.

## Decision

Create migration `291-create-trinity-b-lots-4-15-and-21.sql`.

The migration:

- copies `B-5` northward to create eastern lot `B-4`
- copies `B-14` northward to create middle lot `B-15`
- creates `B-21` directly west of `B-15` using the same footprint
- makes `B-4`'s southern edge coincident with `B-5`'s northern edge
- makes `B-15`'s southern edge coincident with `B-14`'s northern edge
- makes `B-21`'s eastern edge coincident with `B-15`'s western edge
- preserves the complete boundary between `B-15` and `B-4`
- scopes all three lots directly to Section B with no block identifiers
- assigns standard burial use without assigning gravesites or moving markers

## Consequences

Section B gains an aligned three-lot row consisting of `B-21`, `B-15`, and `B-4` from west to east. Existing lots, gravesites, and markers remain unchanged.

## Rebuild And Validation

Run:

```bash
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:migrate
APP_ENV=test npm run db:validate:spatial
APP_ENV=dev npm run db:validate
APP_ENV=dev npm run db:migrate
APP_ENV=dev npm run db:validate:spatial
```

Confirm all four specified shared edges are complete and all three new lots retain matching dimensions.

## Update Triggers

Update this ADR if any lot's surveyed position, dimensions, alignment, burial-use status, or identifier changes.
