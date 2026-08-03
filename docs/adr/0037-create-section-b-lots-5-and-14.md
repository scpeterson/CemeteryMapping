---
---

# ADR 0037: Create Section B Lots 5 and 14

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

Trinity Section B needs a two-lot row beginning six feet north of the row containing `B-13` and `B-6`. The western lot is `B-14`, and the eastern lot is `B-5`. The new lots' eastern and western boundaries must align with the existing two columns.

## Decision

Create migration `289-create-trinity-b-lots-5-and-14.sql`.

The migration:

- copies `B-13` northward to create western lot `B-14`
- copies `B-6` northward to create eastern lot `B-5`
- leaves a measured six-foot gap between the rows
- preserves the source lots' recorded dimensions and exact footprints
- aligns each new lot's eastern and western boundaries with its source column
- maintains the boundary shared by `B-14` and `B-5`
- scopes both lots directly to Section B with no block identifiers
- assigns standard burial use without assigning gravesites or moving markers

## Consequences

Section B gains an aligned row consisting of `B-14` and `B-5`, separated from the row below by six feet. Existing lots, gravesites, and markers remain unchanged.

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

Confirm both row gaps measure six feet, the new lots share their full vertical boundary, and their east/west boundaries align with the established columns.

## Update Triggers

Update this ADR if either lot's surveyed position, dimensions, alignment, row gap, burial-use status, or identifier changes.
