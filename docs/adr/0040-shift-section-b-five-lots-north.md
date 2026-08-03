---
---

# ADR 0040: Shift Five Section B Lots North

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

The reviewed placement of Trinity Section B lots `B-4`, `B-5`, `B-14`, `B-15`, and `B-21` needs to move one foot north. Their dimensions, relative alignment, and shared boundaries must remain unchanged.

## Decision

Create migration `292-shift-trinity-b-lots-4-5-14-15-and-21-north.sql` to translate all five lots together.

The migration calculates one shared one-foot northward latitude offset at the group's center and applies that exact offset to every geometry. It does not resize the lots, alter their relative positions, assign gravesites, or move markers.

## Consequences

All five lots appear one foot farther north while retaining their footprints and exact internal boundaries. The gap between the `B-14`/`B-5` row and the row below returns to six feet. All other cemetery features remain unchanged.

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

Confirm the group moved one foot north, all internal shared boundaries remain complete, and the lower row gap measures six feet.

## Update Triggers

Update this ADR if any affected lot's surveyed position, dimensions, alignment, or identifier changes.
