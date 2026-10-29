---
---

# ADR 0171: Retire thirteen defunct Section D temporary lots

- Date: 2026-10-29
- Status: Accepted

## Decision

The owner reports that older maps show thirteen temporary Section D lots as
defunct and requests their deletion. Migration 496 retires D-TMP03 through
D-TMP12 and D-TMP15 through D-TMP17. The supplied list repeats D-TMP05; it is one
lot and is retired once. Internal lot identifiers are TMPxx, although display
names currently use D-TEMP-xx. This is owner-provided historical interpretation;
this change does not claim an independent review of the older maps.

Use the existing deleted_at, deleted_by and delete_reason fields so the lots
leave the active map while original geometry, provenance and audit history
remain recoverable. Do not alter gravesites, monuments, section boundaries,
passageways or ownership. D-TMP01, D-TMP02, D-TMP13 and D-TMP14 remain active.
The passageway review remains a proposal, not a geometry or assignment change.

Require exactly thirteen distinct active, non-burial targets, in one cemetery,
scoped to facility 1, Section D and no block. Lock targets while checking that
no gravesites, ownership events/rights, historic evidence or restricted areas
reference them. Any dependency or incomplete target set stops the migration
before updates. Databases without active Trinity Section D lots skip it.

## Validation and recovery

Exercise isolated TEST fixtures for exact membership, retained temporary lots,
other sections/facilities, missing targets, wrong cemetery/restriction and each
dependency class. Rehearse against DEV with rollback and compare full rows and
protected-table hashes. Back up DEV before applying through Liquibase, then
verify only the retirement fields changed on the thirteen lots. Source history
and geometry remain available for recovery through a reviewed forward correction;
automatic SQL rollback is empty, matching earlier owner-directed retirements.
Hosted TEST receives the change through a separately authorized PR/deployment.

## Later changes

D-TMP01 is later renamed D-78 by migration 498. The passageway review is later implemented by migrations 502–503, with the later C-P03 correction in 504. See [ADR 0173](0173-number-d78-and-shift-section-d-group-west.md), [ADR 0178](0178-passageways-and-individual-deeds.md) and [ADR 0179](0179-shift-southern-c-lots.md).
