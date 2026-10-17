---
---

# ADR 0050: Split A-0020 Pfeiffer Gravesites

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-09-03

## Decision

Migration 371 retains Edward G Pfeiffer in A-0020 and creates A-0020A
(TLC-GPS-0020-01) immediately north for Edna M Pfeiffer. Existing burial
records, dates, and statuses are preserved. The A suffix is an operational
identifier rather than a historical cemetery label.

The estimated polygons are each 4 by 10 feet, extending east from fixed
marker TLC-HS-0020. A-0020 moves south so the marker is on the shared
north/south boundary. The marker remains linked to both burials and actively
spans both gravesites. Its observed coordinates are unchanged.

## Limitations

The proposed polygons have small boundary overlaps with A-0012/A-0012A:
approximately 0.025 square metres for each principal overlap, plus a
0.001-square-metre sliver. These are unresolved estimated-boundary conflicts,
not evidence of physical burial overlap. Neighboring geometry is unchanged.
Field review should reconcile the estimated boundaries.

Structured birth and death dates are missing despite years in the inscription.
This placement correction preserves the existing date fields rather than
inventing precise dates or treating missing death dates as pre-need evidence.

## Validation And Recovery

Run the schema tests and changelog validation. When applying, verify burial
assignments, north/south order, shared marker links, unchanged dates and
statuses, and unchanged marker geometry.

The migration has an empty rollback like previous reviewed splits. Recovery
should use a backup or a forward correction to preserve subsequent edits.
