---
---

# ADR 0066: Split A-0078 Dozer Gravesites

- Status: Accepted
- Date: 2026-09-17

## Decision

Migration 405 retains Charles E Dozer in A-0078 (`TLC-GPS-0078`) and assigns
the existing Corinne E Dozer burial to A-0078A (`TLC-GPS-0078-01`) immediately
north. The A suffix is an operational identifier.

TLC-HS-0078 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. Charles's polygon moves south, placing the marker at
the shared boundary. Existing burial fields, including Charles's Reverend
prefix, and statuses are preserved. Prerequisites identify people by structured
names so prefix formatting differences between environments do not block the split.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0078 | A-0077A | 1.8963 |
| A-0078 | A-0070 | 0.3401 |
| A-0078A | A-0079 | 0.8335 |
| A-0078A | A-0070 | 0.0614 |
| A-0078A | A-0070A | 0.3401 |

These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. The A-0077A overlap is substantial relative
to the proposed 3.7161-square-metre grave polygon. The geometry is an operational
estimate based on the requested north/south arrangement and fixed marker,
not a surveyed boundary. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates and neighboring
records, and preserved burial fields. Corinne's polygon is north of Charles's
and the pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
