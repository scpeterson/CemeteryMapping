---
---

# ADR 0049: Split A-0026 Brandt Gravesites

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-09-03

## Decision

Migration 370 retains Walter C Brandt in A-0026 and creates A-0026A
(TLC-GPS-0026-01) immediately north for Mary M Brandt. Both existing burial
records, dates, and statuses are preserved. The northern A suffix is an
operational identifier, not a historical cemetery label.

The estimated polygons are each 4 by 10 feet, extending east from fixed
marker TLC-HS-0026. A-0026 moves south so the marker is on the shared
north/south boundary. The marker remains linked to both burials and actively
spans both gravesites. Its observed coordinates are unchanged.

## Limitations

The proposed northern polygon overlaps A-0027 by approximately 0.634 square
metres (6.8 square feet). This is an unresolved estimated-boundary conflict,
not evidence that physical graves overlap. Neighboring geometry is not altered;
field review is needed to reconcile the boundaries.

Walter's stored death date is 1945-03-18, while the inscription records 1943.
Mary's structured dates are missing despite years in the inscription.
This placement correction does not resolve those date discrepancies or invent
dates; all existing burial facts are preserved.

## Validation And Recovery

Validate the changelog and schema tests. When applying, verify assignments,
north/south order, marker links, unchanged dates, and unchanged marker geometry.
The migration has an empty rollback like prior reviewed splits; recovery should
use a backup or a forward correction to avoid discarding subsequent edits.
