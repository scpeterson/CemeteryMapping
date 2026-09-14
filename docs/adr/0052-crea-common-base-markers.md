---
---

# ADR 0052: Separate Crea Markers on a Common Base

- Status: Accepted
- Date: 2026-09-14

## Decision

Migration 389 preserves James H Crea's A-0038 gravesite and TLC-HS-0038 marker,
including their geometry. It creates A-0038A (`TLC-GPS-0038-01`) and
TLC-HS-0038A immediately north for the existing Ella R Pfeiffer burial.
The A suffix is an operational identifier.

These are separate physical markers on a common base. Each marker links to
its own burial and primary gravesite; a `common_base` marker relationship
records the shared structure. Ella's former link to James's marker is
soft-deleted. Burial names, dates, and other person fields are preserved.

The user's field review confirms the separate northern marker and shared
base. NHG entries (5A, 2) and (5A, 3) corroborate the common base and identify
Ella's inscription as “Ella R. Pfeiffer / wife of / James H. Crea / 1886-1962”.
Her marker's current condition remains unknown; historic condition wording
is not treated as a current inspection.

## Placement and Validation

The new polygon copies the existing 4-by-10-foot estimated footprint,
translated north by its north/south extent. The new marker receives the
same translation, approximately four feet. The original marker is not
reinterpreted as the center of the shared base or moved. The new position
is estimated and marked for review until surveyed.

A transaction against the current DEV records verified the separate burial
links, common-base link, northward placement, unchanged original geometry
and notes, and preserved burial fields, then rolled back. No positive-area
overlaps above 0.0001 square metres were found with active mapped gravesites.
Liquibase changelog validation passed before application.

This migration has an empty rollback. Recovery requires a forward correction
or backup restoration; preserve subsequent edits when correcting records.
