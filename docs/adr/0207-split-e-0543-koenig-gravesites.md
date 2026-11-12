# ADR 0207: Separate the Köenig graves beside TLC-HS-0543

Status: Accepted
Date: 2026-11-12

The owner confirms Margareta Köenig remains in E-0543 and Nicholas Köenig needs a new adjoining gravesite to its southeast. Keep TLC-HS-0543 fixed. The owner explicitly accepts mapped overlap because this historic section has uncertain grave boundaries.

Migration 517 renames E-0543 to Margareta Köenig without shifting its geometry, creates E-0543A (TLC-GPS-0543-01) by translating the existing 4-by-10-foot operational outline one width southeast, and transfers Nicholas’s existing burial. Preserve both burial identities, details and monument/burial links. Link the monument to both graves. The new outline overlaps E-0573 (Illegible); document the accepted estimated boundary without moving neighbors or treating it as surveyed accuracy.

Reject unexpected burial assignments, missing fixed marker geometry, occupied identifiers or incompatible original geometry before updates. Environments without E-0543 skip the correction. Validate in transaction-isolated fixtures and rehearse against DEV before application. Back up DEV first, then verify unchanged marker, original polygon, neighboring records and burial details, correct southeast placement and both grave links. Recovery uses the pre-migration backup or a reviewed forward correction; automatic rollback is empty. The initial application targeted local DEV; the subsequent hosted TEST deployment is recorded below. STAGE and PROD remain unchanged.

## DEV validation

Applied migration 517 to local DEV on November 12, 2026 after a full custom-format database backup, archive-list validation and transaction rollback rehearsal. All four isolated database tests passed, including accepted overlap, missing prerequisites, occupied identifiers and absent-source behavior. ESLint and whitespace checks passed. Post-application comparisons verified every headstone and neighboring gravesite row, all monument/burial links, original E-0543 geometry and existing burial details; only Nicholas’s gravesite assignment and timestamp changed among burial records. Both graves have active links to the fixed monument. Private backup and verification artifacts are under `db/backups/koenig-0543/dev-2026-11-12T14-44-10.083Z-luSn4k/`.

## Hosted TEST compatibility

Hosted TEST retains the existing ASCII burial names `Margareta Koenig` and `Nicholas Koenig`, while DEV has `Köenig`. The initial hosted-copy rehearsal rejected these names before any live changes. Broaden only migration 517's name prerequisites and Nicholas lookup to accept both exact spellings; preserve existing burial names and details. Explicitly accept DEV's previously applied checksum `9:9c0fedbbc22acce3efc425d0c9ed0123` using `validCheckSum`, so DEV does not rerun the correction or require clearing checksums. Both spellings are covered by transaction-isolated tests; all five tests and DEV Liquibase validation pass.

## Hosted TEST application

Applied and verified on November 12, 2026 after restored-copy rehearsal and a final validated backup. Both active graves link to the unchanged monument. Southeast adjacency, valid polygons and the accepted approximately 0.7824-square-metre overlap with E-0573 were verified. Only the intended gravesite, burial-assignment, monument/grave-link, audit and Liquibase history tables changed; unrelated table fingerprints, neighboring records and burial details were preserved. TEST is healthy, no migrations remain pending and its application release is unchanged. See the [hosted deployment record](../hosted-test.md#november-12-2026-koenig-gravesite-correction) for recovery material and verification scope.
