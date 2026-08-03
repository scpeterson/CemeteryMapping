---
---

# ADR 0032: Shift Section B Lots 8 and 11 West

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

The reviewed placement of Trinity Section B lots `B-8` and `B-11` needs to move one foot west. Their dimensions, relative alignment, and shared boundary must remain unchanged.

## Decision

Create migration `283-shift-trinity-b-lots-8-and-11-west.sql` to translate both lots one foot west. Migration `284-preserve-trinity-b-lots-8-and-11-shared-edge.sql` snaps `B-11` to the shared longitude after translation to eliminate any floating-point seam from the geographic projection calculation.

The migration calculates a one-foot westward longitude offset at each lot's center and applies that offset to the complete lot geometry. It does not resize either lot, alter their shared boundary, assign gravesites, or move markers.

## Consequences

`B-8` and `B-11` retain their matching footprints and remain directly adjacent, but both appear one foot farther west. All other cemetery features remain unchanged.

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

Confirm that both lot centers moved one foot west, the lots still share their complete 16-foot boundary, and their dimensions are unchanged.

## Update Triggers

Update this ADR if either lot's surveyed position, dimensions, alignment, or identifier changes.
