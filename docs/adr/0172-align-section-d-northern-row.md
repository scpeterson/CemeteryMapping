# ADR 0172: Align the northern Section D row east

- Date: 2026-10-29
- Status: Accepted

## Decision

The owner requests moving D-53, D-5, D-33, D-TMP14 and D-TMP13 east so their
nominal side edges align with D-54, D-51, D-34, D-32 and D-25 respectively.
Migration 497 measures one longitude offset from D-53's west edge to D-54's
west edge (approximately 6.7 feet east on reviewed DEV data), preserving the
row's latitude, nominal dimensions, identifiers and relative column positions.

Reconstruct the two temporary lots' full nominal rectangles from D-53's row
before clipping them to the current cemetery boundary. Translating previously
clipped geometry would retain the old cut and lose part of the new footprint.
The exact alignment also places about nine square feet of D-33 outside the mapped
cemetery. The owner additionally authorizes clipping D-33 while keeping it a
standard lot. Clip D-33 against the boundary after translation.
Mark both temporary lots non_burial, with explicit notes prohibiting gravesites and
monuments. Existing map styles, labels, detail text and placement restrictions
use this status. This supersedes ADR 0105's standard status for those two lots;
the original creation migration remains unchanged.

Require both complete rows in one cemetery, consistent nominal alignment,
valid target/boundary geometry, positive eastward displacement, nonempty clipped
results, cemetery coverage and no overlap with unrelated active lots. Refuse
references from gravesites, ownership, historic evidence or restricted areas.
Retired temporary lots stay retired. Do not move observed monuments, graves,
section boundaries, or the southern row. Passageway proposals are unchanged.

## Validation and recovery

Test exact five-lot membership, aligned side edges, unchanged latitude and
metadata, exact intersection of reconstructed temporary footprints, retained
southern/retired lots, and refusal of missing anchors, incompatible rows,
dependencies, boundary failures and neighboring overlaps. Rehearse on DEV with
rollback and compare unrelated lot rows and protected-table hashes. Retain a
validated private backup before Liquibase application and repeat checks after it.
Actual reviewed clipped areas are approximately 252.7, 163.6 and 55.5 square feet
for D-33, TMP14 and TMP13 respectively; these are map footprints, not burial capacity. Recover via a
reviewed forward correction or backup; automatic rollback is empty. Hosted TEST
requires a separately authorized deployment.
