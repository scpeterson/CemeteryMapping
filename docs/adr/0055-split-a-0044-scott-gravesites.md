---
---

# ADR 0055: Split A-0044 Scott Gravesites

- Status: Accepted
- Date: 2026-09-14

## Decision

Migration 392 retains Freeman Paul Scott in A-0044 (`TLC-GPS-0044`) and
assigns the existing Beulah M Scott burial to A-0044A (`TLC-GPS-0044-01`)
immediately north. The A suffix is an operational identifier. Existing
burial names, dates, statuses, military details, and other fields are preserved.
The original gravesite name is expanded to match Freeman's existing full name.

TLC-HS-0044 stays fixed and linked to both burials, with active `spans`
relationships to both gravesites. Each estimated polygon measures 4 by
10 feet and extends east from the marker. Freeman's polygon shifts south
so the marker lies on the shared north/south boundary. No new marker is created.

## Estimated Boundary Conflicts

| Gravesite | Neighbor | Overlap (square metres) |
| --- | --- | --- |
| A-0044 | A-0057 | 0.1173 |
| A-0044A | A-0058 | 0.0274 |
| A-0044A | A-0045 | 0.5757 |

These are unresolved mapped-boundary conflicts, not evidence of physical
burial overlap. Neighboring geometry remains unchanged. The northern overlap
with A-0045 especially requires field measurements to reconcile the estimates.

## Validation and Recovery

A rolled-back DEV transaction verified burial assignments, preserved dates
and other burial fields, unchanged marker and neighboring records, both
spanning links, and valid north/south polygons without mutual area overlap.
Validate the Liquibase changelog before application.

This migration has an empty rollback. Recovery requires a forward correction
or backup restoration that accounts for subsequent edits.
