---
---

# ADR 0038: Shift Section B Lots 5 and 14

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-03

## Context

The reviewed placement of Trinity Section B lots `B-14` and `B-5` needs to move two feet west and one foot south. Their dimensions, relative alignment, and shared boundary must remain unchanged.

## Decision

Create migration `290-shift-trinity-b-lots-5-and-14-west-and-south.sql` to translate both lots together.

The migration calculates shared two-foot westward and one-foot southward coordinate offsets at the row's center and applies those exact offsets to both geometries. It does not resize the lots, alter their relative positions, assign gravesites, or move markers.

## Consequences

`B-14` and `B-5` appear two feet farther west and one foot farther south while retaining their footprints and exact shared boundary. All other cemetery features remain unchanged.

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

Confirm the row moved two feet west and one foot south, the two lots still share their complete boundary, and their dimensions are unchanged.

## Update Triggers

Update this ADR if either lot's surveyed position, dimensions, alignment, or identifier changes.
