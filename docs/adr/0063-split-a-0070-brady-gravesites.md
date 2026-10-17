---
---

# ADR 0063: Split A-0070 Brady Gravesites

- Status: Accepted
- Date: 2026-09-16

## Decision

Migration 401 retains Charles M Brady in A-0070 (`TLC-GPS-0070`) and assigns
the existing Marion Milford Brady burial to A-0070A (`TLC-GPS-0070-01`) immediately
north. The A suffix is an operational identifier.

TLC-HS-0070 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. Charles's polygon moves south, placing the marker at
the shared boundary. Existing burial fields and statuses are preserved.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0070 | A-0078 | 0.2032 |
| A-0070A | A-0078 | 0.1214 |
| A-0070A | A-0079 | 0.0540 |
| A-0070A | A-0071 | 0.2959 |

These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates and neighboring
records, and preserved burial fields. Marion's polygon is north of Charles's
and the pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
