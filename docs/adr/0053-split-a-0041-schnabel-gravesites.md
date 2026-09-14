---
---

# ADR 0053: Split A-0041 Schnabel Gravesites

- Status: Accepted
- Date: 2026-09-14

## Decision

Migration 390 retains Philip Schnabel Jr. in A-0041 (`TLC-GPS-0041`) and
assigns the existing Nettie Schnabel burial to new A-0041A
(`TLC-GPS-0041-01`) immediately north. Names, dates, statuses, and other
burial details are preserved. The A suffix is an operational identifier.

The existing TLC-HS-0041 marker remains fixed and linked to both burials.
It spans both gravesites. Each estimated polygon is 4 by 10 feet, extending
east from the marker; Philip's polygon moves south to place the marker at
the shared north/south boundary. No new marker is created.

## Estimated Boundary Conflicts

The proposed geometry has small overlaps with neighboring estimated polygons:

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0041 | A-0034 | 0.0449 |
| A-0041 | A-0034A | 0.0006 |
| A-0041A | A-0034A | 0.0449 |
| A-0041A | A-0035 | 0.0104 |

These are unresolved mapped-boundary conflicts, not evidence of overlapping
physical burials. Neighboring records remain unchanged. Field measurements
should reconcile these estimated boundaries.

## Validation and Recovery

A rolled-back DEV transaction verified the two burial assignments, both
active spanning relationships, unchanged marker and neighboring records,
preserved burial fields, and valid north/south polygons without mutual
area overlap. Liquibase validation is required before application.

Like the preceding reviewed splits, the migration has an empty rollback.
Use a forward correction or backup restoration, preserving subsequent edits.
