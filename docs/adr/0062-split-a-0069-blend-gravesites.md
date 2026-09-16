# ADR 0062: Split A-0069 Blend Gravesites

- Status: Accepted
- Date: 2026-09-16

## Decision

Migration 400 retains Henry L Blend in A-0069 (`TLC-GPS-0069`) and assigns
the existing Bertha M Blend burial to A-0069A (`TLC-GPS-0069-01`) immediately
north. The A suffix is an operational identifier.

TLC-HS-0069 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. Henry's polygon moves south, placing the marker at
the shared boundary. Existing burial fields and statuses are preserved.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0069 | A-0059 | 0.0040 |
| A-0069 | A-0068 | 0.0939 |
| A-0069A | A-0059 | 0.0111 |

These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates and neighboring
records, and preserved burial fields. Bertha's polygon is north of Henry's
and the pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
