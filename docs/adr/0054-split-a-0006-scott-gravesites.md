---
---

# ADR 0054: Split A-0006 Scott Gravesites

- Status: Accepted
- Date: 2026-09-14

## Decision

Migration 391 retains Herb Scott in A-0006 (`TLC-GPS-0006`) and assigns
Patricia Scott's existing pre-need record to A-0006A (`TLC-GPS-0006-01`)
immediately north. The A suffix is an operational identifier.

TLC-HS-0006 stays fixed and linked to both person records, with active
`spans` relationships to both gravesites. Each estimated polygon measures
4 by 10 feet and extends east from the marker. Herb's polygon shifts south
so the shared marker is at the north/south boundary. No new marker is created.

Patricia's pre-need status, birth-year text, and absent death and burial dates
are preserved. Her new gravesite is Reserved, rather than inheriting the
original grave's Occupied status. This does not assert deeded ownership or
an interment. Herb's status and all other burial fields remain unchanged.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0006 | A-0054 | 0.0395 |
| A-0006 | A-0055 | 0.0006 |
| A-0006A | A-0054 | 0.0117 |
| A-0006A | A-0055 | 0.1599 |

These are unresolved mapped-boundary conflicts, not evidence of physical
burial overlap. Neighboring records remain unchanged. Field measurements
should reconcile the estimated boundaries.

## Validation and Recovery

A rolled-back DEV transaction verified person assignments, pre-need and
reserved statuses, preserved dates and other burial fields, unchanged marker
and neighbors, both spanning links, and valid north/south polygons without
mutual area overlap. Validate the Liquibase changelog before application.

This migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
