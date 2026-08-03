---
---

# ADR 0033: Create Section B Lots 7 and 12

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

Trinity Section B needs a second two-lot row directly north of lots `B-11` and `B-8`. The western lot is `B-12`, and the eastern lot is `B-7`. The new row's southern boundaries must coincide with the existing row's northern boundaries.

## Decision

Create migration `285-create-trinity-b-lots-7-and-12.sql`.

The migration:

- copies `B-11` northward to create western lot `B-12`
- copies `B-8` northward to create eastern lot `B-7`
- preserves the source lots' recorded dimensions and exact footprints
- makes each new southern edge coincident with its source lot's northern edge
- preserves the west-to-east boundary shared by the two columns
- scopes both lots directly to Section B with no block identifiers
- assigns standard burial use without assigning gravesites or moving markers

## Consequences

Section B gains a second aligned row consisting of `B-12` and `B-7`. Existing lots, gravesites, and markers remain unchanged.

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

Confirm the two horizontal shared boundaries are complete, `B-12` and `B-7` share their full vertical boundary, and all four lots have matching dimensions.

## Update Triggers

Update this ADR if any lot's surveyed position, dimensions, alignment, burial-use status, or identifier changes.
