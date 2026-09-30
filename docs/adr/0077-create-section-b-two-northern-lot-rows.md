---
---

# ADR 0077: Create Two Northern Section B Lot Rows

## Status

Accepted

## Date

2026-09-30

## Decision

Migration 418 adds eight Trinity Section B lots, copying the current rectangular
B-4 geometry and its recorded 16.36 by 16.00 foot dimensions. The southern row
starts six feet due north of B-4's northern edge, with its eastern edge aligned
to B-4. Lots touch within each row, and the northern row touches the southern row.

| Row / west to east | Westernmost | | | Easternmost |
| --- | --- | --- | --- | --- |
| North | B-23 | B-19 | B-17 | B-2 |
| South | B-22 | B-20 | B-16 | B-3 |

Longitude/latitude translations preserve B-4's exact footprint and produce
coincident shared edges, following the established Section B construction.
The six-foot gap is converted to latitude using PostGIS geography at the center
of B-4's northern edge. This is estimated operational geometry, not a survey.

The migration rejects reused identifiers (including retired lots), a changed
nonrectangular anchor, and overlap with existing active lots. Environments with
no active Trinity Section B lots are skipped. Existing lots, gravesites, burials,
markers, ownership, and photos are unchanged; no gravesites are created or assigned.

## Validation and recovery

Validate the changelog and run the geometry integration tests in TEST. Rehearse
the migration inside a rolled-back transaction against DEV, take a database
backup, then apply the normal migration and confirm eight lots, row order,
matching dimensions, shared edges, and the six-foot gap.

Automatic rollback is intentionally empty for this reviewed data addition.
After application, use a reviewed forward correction if placement needs to
change; do not delete lots that have acquired gravesite or ownership references.

## Update triggers

Update this decision if numbering, spacing, dimensions, or reviewed placement changes.
