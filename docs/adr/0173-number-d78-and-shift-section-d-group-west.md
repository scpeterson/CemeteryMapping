---
---

# ADR 0173: Number D-78 and shift twelve Section D lots west

- Date: 2026-10-29
- Status: Accepted

## Decision

The owner requests removing the non-burial restriction from D-TMP01, assigning
its next Section D number, and moving the neighboring group west to contain
TLC-HS-0496. The highest existing numeric D identifier, including retired history,
is 77. Rename the same lot UUID to lot_id 78 / display name D-78, record both old
temporary labels in provenance, and replace the obsolete restriction note.

The initial list omits intervening D-30 and D-TMP02; moving around those fixed
lots would cause overlaps. The owner explicitly includes both after review and
confirms retired D-TMP03 stays retired with its outline unchanged. Migration 498
therefore translates exactly D-27, D-28, D-29, D-30, D-36, D-37, D-48, D-49,
D-56, D-57, former D-TMP01, and D-TMP02. D-TMP02 retains its non-burial status.

Compute one longitude offset so the western edge of former D-TMP01 is one inch
west of the marker's recorded point. This is approximately 9.28 inches west on
reviewed DEV data. Apply the same offset to every vertex of all twelve lots,
retaining latitude, dimensions, adjoining edges and relative positions. Do not
move or reassign markers, gravesites, burials, ownership or photos. The marker
is represented by a point; this is mapped point clearance, not measurement of
its physical footprint or a survey assertion.

Require all targets in one cemetery, an unused next number of 78, non-burial
TMP01 and retired TMP03, valid target and cemetery geometry, an active marker
linked to this cemetery, westward displacement, strict marker containment,
cemetery coverage and no overlaps with other active lots. Reject all target
references from gravesites, ownership, historic evidence or restricted areas.
Databases without active Trinity Section D skip the correction. Incompatible
layouts stop before persistent changes. Use the existing audit context.

## Validation and recovery

Exercise isolated TEST fixtures for exact target membership, preserved marker
and gravesite rows, retained retired lot and other restrictions, unchanged UUIDs
and dimensions, shared translation, marker containment/clearance, unused numbering,
missing/incompatible data, dependency guards and neighboring/cemetery conflicts.
Rehearse on DEV with rollback and compare all unrelated lot rows and protected
table hashes. Back up DEV before Liquibase application and repeat verification
afterward. Recover through the backup or a reviewed forward correction; automatic
SQL rollback is empty. Hosted TEST requires separately authorized deployment.
