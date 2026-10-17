---
---

# ADR 0108: Align C-0383 and Retire the C-0425 Import Placeholder

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-10-17

## Context

DEV and hosted TEST show William Hamilton DeCourcy's estimated 4-by-10-foot C-0383 polygon assigned to C-83, with approximately 1.152 square feet extending into C-82. The family registry entry lists William & Louise DeCourcy against lot 83; the fixed C-0383 marker also lies in C-83. No evidence supports moving this burial to another lot. These lot boundaries are schematic, not surveyed burial boundaries.

The polygon overlaps Allan J Watenpool's C-0384 by approximately 4.940 square feet and the imported C-0425 polygon by 0.484 square feet. C-0425 represents the physical W plot marker, not a burial space. Its `Plot marker, W` pseudo-burial has no interment facts and came from the headstone spreadsheet label.

After the migration-473 correction to Louise's neighboring grave, only about 3.45 feet separates that polygon from C-0384. Moving C-0383 south to remove the northern overlap creates an overlap with Louise's polygon. Source records do not establish smaller grave dimensions. Allan Watenpool's registry entry lists lot 88, but C-0384 currently has no assignment and its location needs separate review.

## Decision

Migration 474 soft-deletes the C-0425 pseudo-burial, placeholder gravesite, and active marker links. It detaches `TLC-HS-0425` from the retired gravesite and preserves the active standalone marker, its geometry, inscription, classification, faces, media references, and source evidence. Retained historical records receive an explanatory retirement reason. The migration recognizes either the recorded W inscription or, for a blank legacy inscription, matching high-confidence TrinityCemeteryFinal3 shapefile provenance plus the original plot-marker import label. It preserves blank inscriptions and unknown marker classifications rather than inventing field observations. The migration rejects real burial facts, missing expected marker evidence, conflicting inscriptions, and conflicting marker relationships before mutation.

Migration 475 translates only `TLC-GPS-0383` west by 0.295 feet (3.54 inches) in EPSG:32617. This eliminates its C-82 spill while preserving its C-83 assignment, dimensions, estimated operational classification, burial records and links, and observed marker. C-0425 must already be retired. The original footprint and expected marker/assignment must match; later geometry edits require review. No historical migration is edited.

The resulting approximately 4.822-square-foot overlap with the unchanged, reviewed C-0384 footprint is an explicit existing-overlap exception. The migration rejects other overlaps, a changed overlapping C-0384 footprint, or an increase in that overlap, and records the actual remaining area in C-0383's geometry notes. C-0384, the corrected C-0382 pair, and all lot polygons remain unchanged.

## Consequences And Verification

The active map retains the W marker without presenting it as an occupied grave or a person. Historical import records remain recoverable. C-0383 fits schematic C-83; its unresolved C-0384 overlap remains visible and documented for separate review. Do not infer a surveyed boundary or shrink C-0383 merely because the burial was a child.

Both migrations skip absent source records and safely repeat without further changes. Database regressions use temporary tables containing reviewed coordinates and the migration-473 neighbor layout. They verify containment, approximately 40-square-foot area, preservation of unrelated records and the complete marker record except its retired primary-grave reference, retirement reasons and links, repeat safety, and prerequisite failures without partial changes.

Run `npm run lint`, `npm run test:server`, and `APP_ENV=test npm run test:db-rules` against a freshly migrated, demo-seeded TEST database with the restricted runtime role configured. Recovery uses a backup or a reviewed forward migration; empty rollback declarations preserve subsequent evidence and edits.

## Hosted TEST Preflight

The first hosted TEST rehearsal found a blank legacy inscription and unknown marker type; DEV had a later W inscription and reviewed classification. The initial guard rejected that valid older import. Before migration 474 was applied to DEV or hosted TEST, its prerequisite was corrected to recognize the exact original import provenance. No checksums were cleared, execution history bypassed, or marker evidence copied from DEV. Regressions cover both marker versions and reject unidentified blanks or conflicting inscriptions.

## Update Triggers

Revisit this decision when field or source evidence establishes C-0384's placement, lot assignment, or the true boundaries/dimensions of these graves, or when evidence establishes a real burial associated with C-0425. Do not restore the plot-marker pseudo-burial as a person.
