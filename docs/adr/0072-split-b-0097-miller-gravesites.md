---
---

# ADR 0072: Split B-0097 Miller Gravesites

- Status: Accepted
- Date: 2026-09-23

## Decision

Migration 414 retains Johannes (John) Mülller (Miller) in B-0097
(TLC-GPS-0097) and assigns the existing Mary Miller burial to B-0097A
(TLC-GPS-0097-01), immediately north. The A suffix is an operational identifier.
The migration also accepts the legacy John Miller spelling without changing
burial names or other details. TLC-HS-0097 remains fixed and linked to both
gravesites as `spans`; faces, photos and marker-person links remain unchanged.

## Estimated Geometry

Both gravesites measure 4 feet north–south by 10 feet east–west and extend
east from the marker's longitude. John's polygon runs from 6 feet south to
2 feet south of the marker. Mary's runs from 2 feet south to 2 feet north.
The shared boundary is therefore 2 feet south of the fixed marker, which
lies along Mary's western edge. The marker's original primary reference to
B-0097 is retained; both gravesites have explicit spanning links.

Shifting the pair south avoids the mapped B-0092 and B-0100 boundaries.
No positive-area mutual or neighboring overlaps were found in DEV. These
are estimated operational boundaries requiring field verification.

## Validation and Recovery

A rolled-back DEV rehearsal verified one burial per grave, Mary north of John,
valid 40-square-foot polygons, both spanning links, no mapped overlaps, and
unchanged marker and burial fields except assignment and update timestamps.
Applied-state verification compares the result with the original snapshot.

Prerequisites guard expected burials and marker, and unused new identifiers.
Environments without the source gravesite are skipped. Rollback is empty;
recovery requires a forward correction or suitable backup.
