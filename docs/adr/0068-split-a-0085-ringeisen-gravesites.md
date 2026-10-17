---
---

# ADR 0068: Split A-0085 Ringeisen Gravesites

- Status: Accepted
- Date: 2026-09-18

## Decision

Migration 408 retains Andrew G Ringeisen in A-0085 (`TLC-GPS-0085`) and assigns
the existing Lena G Ringeisen burial to A-0085A (`TLC-GPS-0085-01`) immediately
north. The A suffix is an operational identifier.

TLC-HS-0085 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. Andrew's polygon moves south, placing the marker at
the shared boundary. Existing burial fields and statuses are preserved.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0085A | A-0086 | 0.1335 |

This mapped boundary conflict requires field measurement; it does not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates and neighboring
records, and preserved burial fields. Lena's polygon is north of Andrew's
and the pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
