---
---

# ADR 0080: Shift Eight Section B Lots West and North

## Status

Accepted

## Date

2026-09-30

## Decision

Migration 421 shifts B-23, B-19, B-17, B-2, B-22, B-20, B-16, and B-3 as one
group, 1.5 feet due west and one foot due north. Compute constant longitude and
latitude offsets using separate PostGIS geography projections at the group's
centroid. Apply the same offsets to every lot, preserving exact footprints,
shared edges, numbering, dimensions, and relative alignment.

This updates ADR 0077's original position. Neighboring lots, including B-24,
B-18, B-1, and B-4, remain fixed. Markers and gravesites retain their coordinates
and assignments; the migration changes only the eight lot polygons and their
placement provenance. Geometry remains estimated operational placement.

Require all eight active lots with valid geometry in one cemetery and reject
any overlap with other active lots. Environments without Trinity B are skipped.

## Validation and recovery

Run isolated geometry tests and validate the changelog. Rehearse in a rolled-back
DEV transaction, back up the database, apply the migration, then verify both
translation distances, shared edges, dimensions, and unchanged unrelated lots.
Automatic rollback is empty; further placement corrections require a reviewed
forward migration.

## Update triggers

Update this decision if the group's position, membership, or dimensions change.
