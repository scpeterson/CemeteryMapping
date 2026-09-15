# ADR 0057: Split A-0049 Elser Gravesites

- Status: Accepted
- Date: 2026-09-15

## Decision

Migration 394 retains William G Elser in A-0049 (`TLC-GPS-0049`) and assigns
the existing Eleanor H Elser burial to A-0049A (`TLC-GPS-0049-01`) immediately
north. The A suffix is an operational identifier.

The request named TLC-HS-0048, but the database establishes TLC-HS-0049 as
the marker linked to A-0049 and both Elser burials. TLC-HS-0048 belongs to
the Scott burials. This correction uses TLC-HS-0049.

TLC-HS-0049 stays fixed, linked to both burials and both gravesites through
`spans` relationships. Estimated polygons measure 4 by 10 feet and extend
east from the marker. William's polygon moves south, placing the marker at
the shared boundary. Existing burial fields and statuses are preserved.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0049 | A-0062 | 0.0023 |
| A-0049 | A-0048A | 0.9639 |
| A-0049A | A-0062 | 0.3323 |

These mapped boundary conflicts require field measurement; they do not
establish physical burial overlap. Neighboring records remain unchanged.

## Validation and Recovery

A rolled-back DEV transaction verified valid polygons, correct burial
assignments, both spanning links, unchanged marker coordinates, and preserved
burial fields. The pair has no positive-area mutual overlap.

The migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
