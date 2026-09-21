---
---

# ADR 0056: Split A-0048 Scott Gravesites

- Status: Accepted
- Date: 2026-09-15

## Decision

The user confirmed Section A after initially referring to C-0048. Migration
393 retains Charles D Scott in A-0048 (`TLC-GPS-0048`) and assigns the existing
Malinda C Scott burial to A-0048A (`TLC-GPS-0048-01`) immediately north.
The A suffix is an operational identifier.

TLC-HS-0048 remains at its existing coordinates, linked to both burials and
both gravesites through `spans` relationships. The estimated 4 by 10 foot
polygons extend east from the marker. Charles's polygon moves south so the
marker sits at the shared boundary. Burial details and statuses are preserved.

## Estimated Boundary Conflicts

The southern A-0048 polygon overlaps estimated A-0047 by 0.6374 square metres
and A-0061 by 0.1709 square metres. A-0048A has no positive-area overlaps
immediately after migration 393. The subsequent Elser split in migration 394
introduces a 0.9639 square metre overlap with A-0049; see ADR 0057.
These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates, and preserved
burial fields. The pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
