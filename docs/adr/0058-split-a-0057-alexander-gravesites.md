---
---

# ADR 0058: Split A-0057 Alexander Gravesites

- Status: Accepted
- Date: 2026-09-15

## Decision

Migration 395 retains Clyde R Alexander in A-0057 (`TLC-GPS-0057`) and assigns
the existing Almira C Alexander burial to A-0057A (`TLC-GPS-0057-01`)
immediately north. The A suffix is an operational identifier.

TLC-HS-0057 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. Clyde's polygon moves south, placing the marker at
the shared boundary. Existing burial fields and statuses are preserved.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0057 | A-0056 | 0.7966 |
| A-0057 | A-0044 | 0.0727 |
| A-0057A | A-0044 | 0.1390 |
| A-0057A | A-0044A | 0.0727 |

These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates and neighboring
records, and preserved burial fields. Almira's polygon is north of Clyde's
and the pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
