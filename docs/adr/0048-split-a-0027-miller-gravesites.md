---
---

# ADR 0048: Split A-0027 Miller Gravesites

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-09-02

## Decision

Migration 369 retains Charles "Cart" Miller in A-0027 and creates A-0027A
(TLC-GPS-0027-01) immediately north for Martha B Miller. Both existing burial
records and their dates are preserved. The original southern gravesite retains
its identifier; the northern A suffix is an operational identifier, not a
historical cemetery label.

The estimated polygons are each 4 by 10 feet, extending east from the fixed
TLC-HS-0027 marker. A-0027 moves south so the marker is on the shared
north/south boundary. The marker remains linked to both burials and actively
spans both gravesites. Its observed coordinates are not changed.

## Validation And Recovery

The proposed polygons were checked against active DEV gravesites and introduce
no neighboring overlaps. Validate the changelog and schema tests, then verify
the burial assignments, north/south ordering, shared-marker links, unchanged
dates, and unchanged marker geometry when applying the migration.

As with previous reviewed splits, the migration has an empty rollback.
Recover through a backup or a forward correction to avoid discarding later edits.
