---
---

# ADR 0079: Shift the Section B Boundary Row Two Feet West

## Status

Accepted

## Date

2026-09-30

## Decision

Migration 420 adjusts the placement from ADR 0078: move B-24, B-18, and B-1
approximately two feet directly west so TLC-HS-0138 and TLC-HS-0139 are strictly
inside B-1. Markers remain at their existing GPS positions and no gravesite or
ownership assignments change.

Calculate one longitude translation from a two-foot westward geography projection
at B-1's southern midpoint. All latitudes stay unchanged. Translate B-24 and B-18
without changing shape or dimensions. Rebuild B-1 by clipping its translated
bounding rectangle against the unchanged cemetery boundary. Its southern and
western edges retain their lengths; the northern and eastern edges lengthen to
meet that boundary, which closes the fifth edge. This supersedes the earlier
B-24/B-23 western alignment and B-1/B-2 eastern alignment in ADR 0078.

Preserve existing lot IDs and recorded dimensions. B-1's width remains its
southern span and length remains nominal western depth, not a rectangular area.
The row's six-foot northward gap is unchanged. Geometry remains estimated
operational placement, not surveyed boundaries.

The migration requires valid source geometry, a five-sided B-1 with the full
shared western edge, both specified markers strictly inside B-1, and no overlap
with other active lots. Boundary comparison permits a tiny coordinate tolerance
for floating-point intersection results. Environments without Trinity B are skipped.

## Validation and recovery

Run the isolated geometry integration tests and changelog validation. Rehearse in
a rolled-back DEV transaction, back up the database, then apply and verify both
markers, preserved lengths and footprints, and unchanged unrelated lots. Keep
marker coordinates unchanged. Automatic rollback is empty; use a reviewed forward
migration for subsequent placement corrections.

## Update triggers

Update this decision if placement, marker coordinates, or the cemetery outline changes.
