---
---

# ADR 0071: Split B-0096 Deer Gravesites

- Status: Accepted
- Date: 2026-09-23

## Decision

Migration 413 retains Charles W Deer in B-0096 (TLC-GPS-0096) and assigns the
existing Obbie Mae Deer burial to B-0096A (TLC-GPS-0096-01), immediately north.
The A suffix is an operational identifier. Legacy Obbie M Deer name spelling
is accepted by the migration without changing burial names or other details.
TLC-HS-0096 remains fixed and links to both gravesites as `spans`. Faces,
inscriptions, photos, burial UUIDs and existing marker-person links are preserved.

## Estimated Geometry

Both polygons measure 4 feet north–south by 10 feet east–west. Their western
edge lies 1.5 feet west of the fixed marker. Charles's grave extends from
1 foot south to 3 feet north of the marker; Obbie's extends from 3 to 7 feet
north. The marker remains within Charles's grave. This small offset avoids
mapped neighboring graves without changing their records.

Coordinates are estimated operational boundaries, not surveyed burial locations.
No positive-area overlaps with active neighboring gravesites were found in DEV.

## Validation and Recovery

A rolled-back DEV rehearsal verified one burial per gravesite, Obbie north of
Charles, valid 40-square-foot polygons, no mutual or neighboring overlaps,
both spanning links, and unchanged marker and burial details apart from
burial gravesite assignments and update timestamps. Applied-state verification
compares these records against the pre-migration snapshot.

Prerequisites guard expected people, their source gravesite and marker, and
unused new identifiers. Environments without the source record are skipped.
Rollback is empty; recovery requires a forward correction or suitable backup.
