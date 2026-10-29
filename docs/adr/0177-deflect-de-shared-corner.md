# ADR 0177: Deflect the shared D/E corner between fixed markers

- Date: 2026-10-29
- Status: Accepted

## Decision

Migration 501 changes only the shared corner at approximately
(-80.080469586, 40.601603927) in Trinity Sections D and E. Keep its longitude
and all other vertices fixed. Project the line from the unchanged western
shared endpoint through the midpoint of TLC-HS-0577 and TLC-HS-0554 to the
corner longitude. Set that same new corner in both polygon rings.

DEV requires about 3.111 feet north and no westward shift. The new dividing
edge gives each recorded marker point about 15.735 inches of clearance:
TLC-HS-0577 strictly inside D and TLC-HS-0554 strictly inside E. This checks
stored points, not measured physical marker footprints. No marker is moved.

Require the reviewed shared topology, both active sections and markers linked
to the cemetery, valid outlines, north-only movement under ten feet, strict
marker containment, and an identical combined section footprint without gaps
or overlap. Other vertices, section metadata, lots, gravesites and markers
retain their stored values. Two audited section updates record the correction.
Missing Trinity sections skip; incomplete or changed layouts fail.

## Validation and recovery

Run `APP_ENV=test node --test scripts/de-shared-corner.integration.mjs`,
`npm run lint` and `npm run db:validate`. Rehearse against DEV in a transaction
and roll back; compare every other vertex and protected-table hashes. Back up
DEV before `npm run db:migrate` and verify two audit events and both marker
containments afterward. Recovery uses that backup or a reviewed forward
correction; automatic SQL rollback is empty. Hosted TEST is separately deployed.
