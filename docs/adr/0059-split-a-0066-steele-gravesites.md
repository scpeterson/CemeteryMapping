---
---

# ADR 0059: Split A-0066 Steele Gravesites

- Status: Accepted
- Date: 2026-09-16

## Decision

Migration 396 retains Wilbert B Steele in A-0066 (`TLC-GPS-0066`) and assigns
the existing Anna S Steele burial to A-0066A (`TLC-GPS-0066-01`) immediately
north. The A suffix is an operational identifier.

TLC-HS-0066 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. Wilbert's polygon moves south, placing the marker at
the shared boundary. Existing burial fields and statuses are preserved.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0066 | A-0054 | 0.1126 |
| A-0066 | A-0055 | 0.0020 |
| A-0066A | A-0054 | 0.0181 |
| A-0066A | A-0055 | 0.0193 |
| A-0066A | A-0056 | 0.0548 |

These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates and neighboring
records, and preserved burial fields. Anna's polygon is north of Wilbert's
and the pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
