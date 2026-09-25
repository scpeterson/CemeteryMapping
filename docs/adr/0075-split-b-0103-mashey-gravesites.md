---
---

# ADR 0075: Split B-0103 Mashey Gravesites

- Status: Accepted
- Date: 2026-09-25

## Decision

Migration 415 retains Amos Mashey in B-0103 (`TLC-GPS-0103`) and assigns
Mary (Gollmar) Mashey's existing burial to new B-0103A (`TLC-GPS-0103-01`),
immediately north. The A suffix is an operational identifier. TLC-HS-0103
remains at its existing coordinates with its original primary reference to
B-0103 and an additional `spans` link to B-0103A. No new burial is created.
Names, maiden name, dates, inscriptions, marker faces, photos, and marker-person
links remain unchanged.

## Estimated geometry

The mapped gap between B-0102 (Howard) and B-0104 (William) is only about five
feet. The owner explicitly approved narrower estimated boundaries and requested
that neighboring graves remain unchanged. Each new outline measures 2.4 feet
north–south by 10 feet east–west; these are operational display boundaries,
not a survey or a statement of physical burial width.

Using the fixed headstone as the reference, Amos's western edge extends from
2.85 feet south to 0.45 feet south. Mary's western edge extends from 0.45 feet
south to 1.95 feet north. Both outlines extend 10 feet east. This moves the
original B-0103 outline south and places Mary immediately north of Amos.
Record the geometry as estimated and require field verification.

## Validation and recovery

A rolled-back DEV rehearsal verified one burial per grave, Mary north of Amos,
valid approximately 24-square-foot polygons, both marker links, and no
positive-area overlaps with active neighboring graves. Snapshot comparisons
verified unchanged headstone data, neighboring B-0102/B-0104 records, burial
personal details, and marker-person/photo links.

Prerequisites require the expected two active burials under the source grave
and marker and unused new identifiers. Environments without the source grave
are skipped. Rollback is empty: preserve a database backup and recover through
a reviewed forward correction or deliberate restore. Applying this migration to
DEV does not automatically apply it to persistent hosted TEST.
