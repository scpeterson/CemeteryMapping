# ADR 0061: Split A-0067 Steele Gravesites

- Status: Accepted
- Date: 2026-09-16

## Decision

Migration 398 retains George H Steele in A-0067 (`TLC-GPS-0067`) and assigns
the existing Bertie I Steele burial to A-0067A (`TLC-GPS-0067-01`) immediately
north. The A suffix is an operational identifier.

TLC-HS-0067 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. George's polygon moves south, placing the marker at
the shared boundary. Existing burial fields and statuses are preserved.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0067 | A-0056 | 0.1344 |
| A-0067 | A-0066A | 0.7482 |

These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates and neighboring
records, and preserved burial fields. Bertie's polygon is north of George's
and the pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
