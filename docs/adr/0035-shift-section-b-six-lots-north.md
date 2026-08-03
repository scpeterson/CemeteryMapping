---
---

# ADR 0035: Shift Six Section B Lots North

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

The reviewed placement of Trinity Section B lots `B-6`, `B-7`, `B-8`, `B-11`, `B-12`, and `B-13` needs to move 2.5 feet north. Their dimensions, column alignment, row alignment, and shared boundaries must remain unchanged.

## Decision

Create migration `287-shift-trinity-b-lots-6-through-13-north.sql` to translate all six lots north by 2.5 feet.

The migration calculates one shared northward latitude offset at the center of the six-lot group and applies that exact offset to every geometry. It does not resize the lots, alter their relative positions, assign gravesites, or move markers.

## Consequences

All six lots appear 2.5 feet farther north while retaining their original footprints and exact shared boundaries. All other cemetery features remain unchanged.

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

Confirm the group moved 2.5 feet north, all six dimensions are unchanged, and every internal shared boundary remains complete.

## Update Triggers

Update this ADR if any affected lot's surveyed position, dimensions, alignment, or identifier changes.
