---
---

# ADR 0027: Create Section C Non-Standard Lot Row

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-02

## Context

Historic maps show a six-lot Section C row extending from 3 feet east of `C-101` to 1 foot west of the eastern edge of `C-11`. The row is 16 feet deep, and its southern edge aligns with the southern edge of the `C-101` row. This preserves the current 6-foot gap from the row containing `C-96`; that gap was approximately 8 feet before the newly created northern rows were shifted 2 feet south.

The historic west-to-east identifiers are `C-73`, `C-72`, `C-63`, `C-62`, `C-43`, and `C-42`. Because `C-73`, `C-72`, `C-43`, and `C-42` already identify other Section C lots, the new records use an `A` suffix for those repeated identifiers.

## Decision

Create migration `278-create-trinity-c-nonstandard-lots-42a-through-73a.sql` to add, west-to-east, `C-73A`, `C-72A`, `C-63`, `C-62`, `C-43A`, and `C-42A`.

The migration:

- computes its western boundary 3 feet east of the eastern edge of `C-101`
- computes its eastern boundary 1 foot west of the eastern edge of `C-11`
- divides the resulting span into six equal-width lots, approximately 16.36 feet each
- aligns the southern boundary with `C-101` and creates a geodesic 16-foot depth
- assigns standard burial use to all six lots
- preserves existing repeated lot identifiers by applying the `A` suffix only to the new records
- creates only lot records and does not create gravesites or move markers

## Consequences

The historic non-standard row is represented without changing or duplicating existing database identifiers. Its position and dimensions are derived from current anchor geometry, allowing it to remain aligned if the anchors are rebuilt.

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

In an environment with the real Section C data, confirm the 3-foot western offset, 1-foot eastern inset, equal lot widths, 16-foot depth, southern-edge alignment with `C-101`, and west-to-east order.

## Update Triggers

Update this ADR if the historic-map interpretation, anchors, offsets, dimensions, identifier suffixes, ordering, or burial-use rules change.
