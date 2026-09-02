---
---

# ADR 0046: Split A-0012 Seeke Gravesites

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-09-02

## Context

The imported Section A record assigned Frederick and Marie Seeke to one estimated gravesite, `A-0012`, and linked both people to shared marker `TLC-HS-0012`. Reviewed burial placement establishes that Frederick occupies the southern space and Marie occupies a distinct space immediately north. The marker point is observed evidence and must not move. The imported Frederick record also contains the typo “Frekerick,” while the marker inscription and reviewed name use “Frederick.”

## Decision

Liquibase migration 367 retains `A-0012` for Frederick Seeke, moves its estimated polygon south of the fixed marker, and creates northern gravesite `A-0012A` (`TLC-GPS-0012-01`) for Marie Seeke. Both spaces are estimated 4-by-10-foot operational polygons. The marker gains active `spans` relationships to both gravesites and remains linked to both burial records. The migration also corrects Frederick's given and full names.

The proposed polygons were checked against all active gravesite geometry and introduce no overlaps.

## Consequences

The map represents two physical burial spaces while preserving the surveyed marker point and the stable original identifier for Frederick. The `A` suffix is an operational identifier created by reviewed repair rather than evidence of a historic cemetery label.

The migration has an empty rollback because reversing an authoritative data correction could discard later edits. Recovery should use a backup or a forward-fix migration.

## Validation

Validate the changelog and schema test, apply the migration, and verify that A-0012A has the greater centroid latitude, both burials point to their intended gravesites, TLC-HS-0012 has not moved, and the marker actively spans both gravesites.
