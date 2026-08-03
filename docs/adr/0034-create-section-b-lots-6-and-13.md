---
---

# ADR 0034: Create Section B Lots 6 and 13

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

Trinity Section B needs another two-lot row directly north of lots `B-12` and `B-7`. The western lot is `B-13`, and the eastern lot is `B-6`. The new row's southern boundaries must coincide with the existing row's northern boundaries.

## Decision

Create migration `286-create-trinity-b-lots-6-and-13.sql`.

The migration:

- copies `B-12` northward to create western lot `B-13`
- copies `B-7` northward to create eastern lot `B-6`
- preserves the source lots' recorded dimensions and exact footprints
- makes each new southern edge coincident with its source lot's northern edge
- preserves the boundary shared by the western and eastern columns
- scopes both lots directly to Section B with no block identifiers
- assigns standard burial use without assigning gravesites or moving markers

## Consequences

Section B gains an aligned row consisting of `B-13` and `B-6`. Existing lots, gravesites, and markers remain unchanged.

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

Confirm the two horizontal shared boundaries are complete, `B-13` and `B-6` share their full vertical boundary, and all lots in the two columns retain matching dimensions.

## Update Triggers

Update this ADR if either lot's surveyed position, dimensions, alignment, burial-use status, or identifier changes.
