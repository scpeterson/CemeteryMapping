---
---

# ADR 0221: Add a burial to an existing gravesite independently of ownership

- Status: Accepted
- Date: 2026-11-21

## Decision

Provide **People → Add burial** on an existing gravesite. An editor can select a
current deed holder to prefill their structured first and last names, or enter a
different person. Review the name and supply burial details before saving.
Legacy joint or organization names require an individual name to be entered;
they are not automatically interpreted as one person.

A burial is independent of ownership. The purchaser may be buried, or may permit
another person to be buried, without a deed transfer. This operation creates a
burial record; it never modifies owners, deeds, ownership rights, geometry or
marker links. A real deed transfer remains a separate ownership workflow.
The selected holder is recorded as provenance, not a shared person identity.

Allow the existing record statuses, including pre-need inscription, using existing
name/date/place/military validation and location capacity policies. Pre-need and memorial
records do not consume burial capacity; unknown status counts conservatively.
Only interred records make the derived gravesite status occupied;
needs-review takes precedence. Edit an existing pre-need record when it
already represents the person; creation rejects an exact name-and-birth match
within the gravesite, including deleted records requiring recovery review.

## Integrity and access

Require editing authority for the target cemetery: a power-user or cemetery-admin
membership, or global administrator. Recheck scope on the server. Lock the
gravesite, validate its draft version and the selected current owner's version,
and create the burial and attributed audit entries in one transaction. Preserve
the form after a failed save. A stable operation UUID and the existing field
operation receipts make identical retries return the original burial; reuse with
a changed payload conflicts. Policy rejection rolls back the receipt as well.

Migration 523 excludes pre-need and memorial inscriptions from capacity counts;
rollback restores the previous conservative counting without changing records.
Database regression tests cover inherited lot
ownership, legacy owners, unchanged ownership/geometry/markers, stale drafts,
duplicate prevention, retry receipts and capacity rollback. Mocked browser tests
cover both person choices, phone layout, cancellation and target membership.
Implementation and local verification do not establish deployment availability.

See [operator instructions](../operator-workflows.md#adding-a-burial-to-an-existing-gravesite).
