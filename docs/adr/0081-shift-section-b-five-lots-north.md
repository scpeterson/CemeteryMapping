---
---

# ADR 0081: Shift Five Section B Lots One Foot North

## Status

Accepted

## Date

2026-09-30

## Decision

Migration 422 shifts B-21, B-15, B-4, B-14, and B-5 together one additional foot
due north from their current positions. This follows the prior placement in
ADR 0040 and is a new adjustment, not a change to that historical migration.

Compute one latitude offset from a one-foot PostGIS geography projection at the
group centroid. Apply that offset to all five lots, keeping longitude, dimensions,
footprints, shared edges, and relative positions unchanged. Other lots, marker
coordinates, gravesites, and existing assignments remain unchanged.

Require all five active lots with valid geometry in one cemetery and reject any
overlap with other active lots. Environments without Trinity B are skipped.
Geometry remains estimated operational placement.

## Validation and recovery

Run isolated geometry tests and changelog validation. Rehearse against DEV in a
rolled-back transaction, back up, then apply and verify exactly five changed lots,
unchanged longitude, one-foot northward translation, and preserved shared edges.
Automatic rollback is empty; later corrections require a reviewed forward migration.

## Update triggers

Update this decision if group membership or placement changes.
