---
---

# ADR 0176: Shift the six-lot D-77 row west

- Date: 2026-10-29
- Status: Accepted

## Decision

Move D-77, D-67, D-68, D-58, D-47 and D-38 by one shared westward
longitude offset. Compute the minimum shift giving fixed TLC-HS-0500 one inch
of mapped clearance inside D-77, and require the same shift to put fixed
TLC-HS-0463 strictly inside D-38. Reviewed DEV geometry requires about
9.064 feet west. Both markers are stored points; physical marker footprints
are not measured by this containment check.

Migration 500 preserves lot dimensions, latitudes, relative alignment, IDs,
restrictions and unrelated records. Require all six active lots in one cemetery,
valid geometry and both active markers linked to that cemetery. Refuse linked
gravesites, ownership, historic evidence or restricted areas, cemetery-boundary
conflicts and overlaps with other active lots. Missing Trinity Section D skips;
partial target layouts fail. Record an audit event for each of the six updates.

## Validation and recovery

Run `APP_ENV=test node --test scripts/d77-row-west.integration.mjs`,
`npm run lint` and `npm run db:validate`. Fixture tests cover the shared
translation, both markers, preserved metadata and guarded failure cases.
Rehearse on DEV with rollback and compare all other lots and protected-table
hashes. Back up DEV before `npm run db:migrate`, then verify the same invariants
and six audit events after application. Recovery uses that backup or a reviewed
forward correction; automatic SQL rollback is empty. Hosted TEST deployment
requires separate authorization.
