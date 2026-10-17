---
---

# ADR 0065: Split A-0077 Frampton Gravesites

- Status: Accepted
- Date: 2026-09-17

## Decision

Migration 403 retains William Walker Frampton in A-0077 (`TLC-GPS-0077`) and assigns
the existing Mildred Frampton burial to A-0077A (`TLC-GPS-0077-01`) immediately
north. The A suffix is an operational identifier.

TLC-HS-0077 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. William's polygon moves south, placing the marker at
the shared boundary. Existing burial fields and statuses are preserved.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0077 | A-0082 | 0.0117 |
| A-0077A | A-0078 | 0.0558 |
| A-0077A | A-0082 | 0.0219 |
| A-0077A | A-0083 | 0.0218 |
| A-0077A | A-0070 | 0.0700 |

These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates and neighboring
records, and preserved burial fields. Mildred's polygon is north of William's
and the pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
