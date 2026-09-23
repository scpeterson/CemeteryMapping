---
---

# ADR 0051: Primary Photo Override

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted, 2026-09-09. Supersedes the strict chronology rule in [ADR 0044](0044-bound-inline-photo-galleries.md).

## Decision

Allow a user with photo-order editing permissions to designate one primary photo per marker or gravesite. Store the choice on the media link, preserving independent choices for shared media. Partial unique indexes enforce one active primary per record; transactions serialize selection changes and retain existing audit and cemetery authorization checks.

Show the primary first, then all remaining photos newest first using capture date with upload date as fallback. Without a primary, retain newest-first sorting. Marker Overviews use the newest primary among their linked records; duplicate images retain any primary designation. Gravesite Overviews use the relevance order described below. Removing the designation or deleting its photo restores chronological fallback.

Replace the ineffective earlier/later gallery controls with Make primary and Remove primary, including in the four-photo inline preview. Keep the existing order API's earlier/later actions for compatibility. No existing photo is automatically designated primary by migration 379.

## Gravesite Overview refinement (2026-09-23)

A gravesite Overview first honors an explicit primary on that gravesite. It then
prefers photos linked directly to the gravesite or its individual markers,
followed by shared-monument face photos associated with a burial in that grave.
Other linked monument photos remain a fallback. Each group retains primary-first,
newest-first ordering, and duplicate URLs appear only once. A shared monument's
primary designation does not override a more relevant group.

Individual markers are identified from their gravesite and burial associations;
known links to another grave or burial exclude them from that group. Face matching
uses burial IDs and photo IDs, not names or inscription text. Marker Overviews
retain their existing photo order. Existing photos and saved primary choices are
not changed. Gravesite media responses include link identity and primary metadata
so explicit choices survive reloads.

## Validation

Run lint, production build, server tests, and the primary-photo and Overview browser regressions. Apply migration 379 before serving the updated API.
