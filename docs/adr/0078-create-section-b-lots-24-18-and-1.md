---
---

# ADR 0078: Create Section B Lots 24, 18, and Boundary-Shaped 1

## Status

Accepted

## Date

2026-09-30

## Decision

Migration 419 creates the next Trinity Section B row, west to east B-24, B-18,
and B-1. B-24 copies B-23's 16.36 by 16 foot rectangular footprint, aligns its
western edge with B-23, and starts six feet north of B-23's northern edge.
B-18 is an identical footprint immediately east with a shared edge.

B-1 shares B-18's complete eastern edge as its western edge. Its southern edge
extends to B-2's eastern alignment. Its northern edge uses the standard row
height and extends east until it meets the cemetery boundary. Its eastern edge
runs north from the southern endpoint to that boundary. The intervening
cemetery boundary closes the polygon, cutting off its northeast corner.

Construct B-1 by intersecting that bounding rectangle with the current cemetery
polygon. The result must be one valid five-sided polygon without holes, with
the full western shared edge and the requested southeast corner. B-1's recorded
width is its southern-edge span (approximately 32.71 feet); its length records
the standard 16-foot western depth. These dimensions do not imply a rectangle.
The narrow northern edge is a consequence of the cemetery boundary's slope.

All geometry is estimated operational placement, not a survey. Reused lot IDs,
invalid sources, unexpected clipping, or overlap with existing lots stop the
migration. Environments without active Trinity Section B are skipped. Existing
lots, gravesites, markers, burials, ownership, and photos are preserved; no
gravesites are created or assigned.

## Validation and recovery

Run the isolated geometry integration tests and validate the changelog. Rehearse
against DEV in a rolled-back transaction, back up the database, apply the
migration, and verify the six-foot gap, alignments, footprints, and B-1 boundary.
Automatic rollback is empty; subsequent corrections require a reviewed forward
migration to preserve any newly acquired lot references.

## Update triggers

Update this decision when lot placement, dimensions, numbering, or the cemetery
boundary changes.
