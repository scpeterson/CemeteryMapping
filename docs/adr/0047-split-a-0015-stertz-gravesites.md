---
---

# ADR 0047: Split A-0015 Stertz Gravesites

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-09-02

## Context

The imported Section A record assigned Alexander F and Emma S Stertz to one estimated gravesite, `A-0015`, and linked both people to shared marker `TLC-HS-0015`. Reviewed placement establishes that Alexander occupies the southern space and Emma occupies a distinct space immediately north. The marker point is observed evidence and must not move. Emma's death date is not recorded and must remain unknown.

## Decision

Liquibase migration 368 retains `A-0015` for Alexander F Stertz, moves its estimated polygon south of the fixed marker, and creates northern gravesite `A-0015A` (`TLC-GPS-0015-01`) for Emma S Stertz. Both spaces are estimated 4-by-10-foot operational polygons. The marker gains active `spans` relationships to both gravesites and remains linked to both burial records.

The proposed geometry overlaps portions of nearby estimated Section A polygons, principally A-0014. The reviewed north/south assignment controls over those non-surveyed operational boundaries.

## Consequences

The map represents two physical burial spaces while preserving the observed marker point and the stable original identifier for Alexander. The `A` suffix is an operational identifier created by reviewed repair rather than evidence of a historic cemetery label. Emma's missing death date remains null and is not interpreted as proof of pre-need status.

The migration has an empty rollback because reversing an authoritative data correction could discard later edits. Recovery should use a backup or a forward-fix migration.

## Validation

Validate the changelog and schema test, apply the migration, and verify that A-0015A has the greater centroid latitude, both burials point to their intended gravesites, TLC-HS-0015 has not moved, and the marker actively spans both gravesites.
