---
---

# ADR 0029: Create Third and Fourth Section C Non-Standard Lot Rows

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-02

## Context

Two more six-lot historic Section C rows are needed north of the rows containing `C-73A` through `C-42A` and `C-74A` through `C-41A`. The new block repeats the same six-column, 16-foot-deep row layout. Its western edge aligns with `C-74A`, while its southern edge aligns with `C-111`.

The southern row is historically numbered, west-to-east, `C-75`, `C-70`, `C-65`, `C-60`, `C-45`, and `C-40`. The northern row is `C-76`, `C-69`, `C-66`, `C-59`, `C-46`, and `C-39`. Repeated identifiers receive an `A` suffix.

## Decision

Create migration `280-create-trinity-c-nonstandard-lots-39a-through-76a.sql` to add two adjoining rows.

The resulting west-to-east identifiers are:

- southern row: `C-75A`, `C-70A`, `C-65`, `C-60`, `C-45A`, `C-40A`
- northern row: `C-76A`, `C-69`, `C-66`, `C-59`, `C-46A`, `C-39A`

The migration:

- aligns the western boundary with `C-74A`
- aligns the southern boundary with `C-111`
- reuses `C-74A` as the column-width template
- creates two exactly adjoining rows, each with a geodesic 16-foot depth
- assigns standard burial use to all twelve lots
- preserves existing repeated lot identifiers by applying the `A` suffix only to the new records
- creates only lot records and does not create gravesites or move markers

## Consequences

The new twelve-lot block continues the historic non-standard grid at the requested northern position without altering any existing lots that share its historic numbering.

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

In an environment with the real Section C data, confirm both anchor alignments, two 16-foot rows, inherited column widths, coincident middle boundary, identifier suffixes, and west-to-east ordering.

## Update Triggers

Update this ADR if the historic-map interpretation, anchors, dimensions, identifier suffixes, ordering, or burial-use rules change.
