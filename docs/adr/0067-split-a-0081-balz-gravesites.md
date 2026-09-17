# ADR 0067: Split A-0081 Balz Gravesites

- Status: Accepted
- Date: 2026-09-17

## Decision

Migration 406 retains William J Balz in A-0081 (`TLC-GPS-0081`) and assigns
the existing Charlotte M Balz burial to A-0081A (`TLC-GPS-0081-01`) immediately
north. The A suffix is an operational identifier.

TLC-HS-0081 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. William's polygon moves south, placing the marker at
the shared boundary. Existing burial fields and statuses are preserved.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0081 | A-0076 | 0.1815 |
| A-0081 | A-0080 | 0.0948 |
| A-0081A | A-0076 | 0.0452 |
| A-0081A | A-0077 | 0.0799 |

These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates and neighboring
records, and preserved burial fields. Charlotte's polygon is north of William's
and the pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
