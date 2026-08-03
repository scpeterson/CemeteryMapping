---
---

# ADR 0036: Shift Six Section B Lots North Six Inches

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

The reviewed placement of Trinity Section B lots `B-6`, `B-7`, `B-8`, `B-11`, `B-12`, and `B-13` needs to move an additional six inches north. Their dimensions, alignment, and shared boundaries must remain unchanged.

## Decision

Create migration `288-shift-trinity-b-lots-6-through-13-north-six-inches.sql` to translate all six lots north by six inches.

The migration calculates one shared six-inch northward latitude offset at the center of the group and applies the same offset to every lot geometry. It does not resize the lots, alter their relative positions, assign gravesites, or move markers.

## Consequences

All six lots appear another six inches farther north while retaining their footprints and exact internal boundaries. All other cemetery features remain unchanged.

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

Confirm the group moved six inches north and every internal shared boundary remains complete.

## Update Triggers

Update this ADR if any affected lot's surveyed position, dimensions, alignment, or identifier changes.
