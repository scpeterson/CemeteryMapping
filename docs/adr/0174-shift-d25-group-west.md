# ADR 0174: Shift the ten-lot D-25 group west

- Date: 2026-10-29
- Status: Accepted

## Decision

The owner requests moving D-25, D-26, D-32, D-31, D-34, D-35, D-50, D-51,
D-54 and D-55 west just enough to contain the marker in D-25. The request types
TTLC-HS-0447; the active stored marker is TLC-HS-0447, with no active match for
the doubled-T spelling. Migration 499 uses that existing marker without renaming it.

Compute a single longitude offset putting D-25's west edge one inch west of the
recorded marker point, then translate all ten lots by that offset. Reviewed DEV
data requires approximately 1.23 inches west. The marker stays fixed and strictly
inside D-25, with one inch of mapped boundary clearance. This is point placement,
not a measured physical marker outline. Dimensions, latitudes, lot identifiers,
relative positions, restrictions and the remaining lots retain their values.

Require all ten active targets in one cemetery, valid footprints and cemetery
boundary, an active marker linked to that cemetery, negative longitude offset,
strict containment, cemetery coverage and no overlaps with other active lots.
Refuse gravesite, ownership, historic-evidence and restricted-area references.
Databases without active Trinity Section D skip; incomplete layouts fail.
No marker, gravesite, burial, ownership, photo or section record is modified.

## Validation and recovery

Test group translation, one-inch clearance, preserved shapes and metadata,
unchanged marker and graves, target/marker/boundary/dependency failures, and
neighbor overlap. Rehearse on DEV with rollback and compare all unrelated lots
and protected-table hashes. Back up DEV before Liquibase application and verify
again afterward. Audit each lot update. Recovery uses the backup or a reviewed
forward correction; automatic SQL rollback is empty. Hosted TEST requires a
separately authorized deployment.
