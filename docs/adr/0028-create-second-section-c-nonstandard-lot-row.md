---
---

# ADR 0028: Create Second Section C Non-Standard Lot Row

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-02

## Context

A second six-lot historic Section C row is needed directly north of and bordering the row containing `C-73A` through `C-42A`. It uses the same equal-width columns and 16-foot depth.

The historic west-to-east identifiers are `C-74`, `C-71`, `C-64`, `C-61`, `C-44`, and `C-41`. Because `C-74`, `C-71`, `C-44`, and `C-41` already identify other Section C lots, the new records use an `A` suffix for those repeated identifiers.

## Decision

Create migration `279-create-trinity-c-nonstandard-lots-41a-through-74a.sql` to add, west-to-east, `C-74A`, `C-71A`, `C-64`, `C-61`, `C-44A`, and `C-41A`.

The migration:

- derives the row's complete east-west span from lots `C-73A` through `C-42A`
- reuses the preceding row's six equal column widths, approximately 16.36 feet each
- makes the new row's southern boundary coincident with the preceding row's northern boundary
- creates a geodesic 16-foot depth
- assigns standard burial use to all six lots
- preserves existing repeated lot identifiers by applying the `A` suffix only to the new records
- creates only lot records and does not create gravesites or move markers

## Consequences

The two non-standard rows form a consistent twelve-lot grid with exact shared column and row boundaries. Existing lots with repeated historic numbers remain unchanged.

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

In an environment with the real Section C data, confirm the shared boundary, equal lot widths, 16-foot depth, identifier suffixes, and west-to-east order.

## Update Triggers

Update this ADR if the historic-map interpretation, dimensions, identifier suffixes, ordering, or burial-use rules change.
