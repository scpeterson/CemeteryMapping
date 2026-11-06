---
---

# ADR 0201: Scoped record recovery and reviewed person merges

- Status: Accepted; not deployed
- Date: 2026-11-05

## Decision

Provide a cemetery-administrator Recovery workspace with searchable, paged deleted
records and explicit, reasoned restoration. A static table/parent allowlist covers
sections, lots/passageways, gravesites, markers, people, features, maintenance,
inspections, photos, photo/observation/gravesite/marker links, ownership events and
rights, legacy owners, and person source records/links. Scope every operation to
the actual administered cemetery. Resolve archived marker scope through its direct
grave (including a deleted parent), then canonical cemetery resolution.

Require a captured row version and active cemetery/parents in the same cemetery.
Restore only the selected row's deletion flag, clear deletion metadata where those
columns exist, advance its editor timestamp and write an audit event. Other
soft-deleted children/links stay deleted. Preserve review status, source, face IDs,
readings and manually-edited flags. Local photo assets require the retained file;
missing files require backup recovery first. Constraint collisions become explicit
conflicts. The map/detail data refresh when administration closes.

## Person duplicates

Merge two explicitly selected active people on the same active gravesite. The UI
compares key details, names the survivor and requires identity acknowledgement,
a reason and confirmation. Survivor details remain intact; original donor details
are retained both in the archived donor row and the merge evidence. Geometry and
cross-gravesite identity corrections require separate review; this workflow does
not merge surveyed markers or gravesite boundaries.

Migration 515 adds the scoped merge ledger. Capture both records and all known
foreign-key relationships, marker/inspection face references and their versions.
A preview hash binds approval to that evidence snapshot; changed evidence requires
another preview. Preview trials relationship transfers inside a rolled-back
savepoint to identify uniqueness/constraint collisions without live changes.
Reject unknown referencing tables so future schema additions cannot silently lose
relationships. Bound interactive evidence volume and archive the full pre-merge
snapshot, actor, reason and checksum.

Move memorials, place evidence, OCR promotion references and person source links to
the survivor. Retain original pure marker/decoration links on the archived donor
and copy missing active facts to the survivor, coalescing shared facts there.
Reject collisions with deleted survivor links or incompatible evidence. Remap only
face person references; keep face IDs, inscriptions, photos, historical readings
and other metadata. All transfers, the ledger and donor soft deletion commit
atomically. Existing face-reference validation locks referenced people/links;
database guards prevent concurrent evidence or marker links from attaching an archived
person after its merge. Never automatically restore a merged donor: that would
duplicate transferred evidence. A separately reviewed correction/backup procedure
is required to undo a merge. Scoped evidence downloads retain the original record
and relationship snapshots.

## Deployment and validation

Apply migration 515 and refresh restricted API-role grants before the new API/UI.
Back up merge evidence with cemetery records. Application rollback can retain the
ledger/guard; dropping the ledger after accepted merges destroys provenance and
removes the donor-restoration safeguard. Prefer a forward correction.

Unit/HTTP checks cover the static allowlist, face evidence preservation and denied
cross-cemetery requests. PostgreSQL fixtures cover unchanged survivor/donor details,
trial rollback, changed-evidence rejection, unknown-reference blocking, moved
memorials, deduplicated face assignments, donor recovery denial, active-link guard,
parent/version recovery checks, missing original photo files and separately
restored links/inspection contexts. Browser checks retain conflict reasons,
require acknowledgement and preview, and fit at 320px. Migration validation,
rollback/reapply, lint, the server suite and production budgets remain required.
