---
---

# ADR 0200: Guided cemetery setup and reviewed imports

- Status: Accepted; not deployed
- Date: 2026-11-05

## Decision

Add an Onboarding administration workflow: a system administrator creates a
cemetery from a reviewed WGS84 Polygon/MultiPolygon boundary, administrators assign
its members, then cemetery administrators stage and approve sources. Existing
cemetery, section and lot editing remains available in Records. Creating a cemetery
does not grant accounts broader roles. Reopen administration after creation to
load the new cemetery in Members and other existing pickers.

Support bounded, additive imports of gravesites from a GeoJSON FeatureCollection
and people from CSV. Map explicit supported fields only. People reference an
existing active gravesite in the selected cemetery; import gravesites first.
Existing specialized spreadsheet/OCR import tools retain their own evidence and
review workflows. This entry does not silently guess column mappings or replace
existing records.

Migration 514 preserves immutable source text, filename, SHA-256 checksum,
normalized records, validation report, creator, reviewer, reason and created record
IDs. Staging never writes live cemetery records. Lists contain review summaries;
full reports and original-source downloads require separate scoped reads.

Validate 1–500 records and a source up to 2 MiB. Reject unknown/duplicate CSV
headers and malformed quoting while retaining quoted commas/newlines. Reject
invalid or empty geometry, invalid WGS84 coordinates, shapes outside the cemetery,
existing/deleted duplicate IDs, source overlaps and overlap with live gravesites.
An optional section must match exactly one active existing section. People retain
recorded dates and notes through the existing burial validator/mutation path;
exact names on the same gravesite, including deleted records, require separate
review rather than silent duplication. Ambiguous cases are blocking errors.
Geometry repairs, snapping, identity matching and overwrites are not automatic.
Imported geometry remains draft evidence requiring survey review.

Approval requires a captured batch version, acknowledgement in the UI and a reason.
Lock the cemetery and batch, rerun validation against current data, then create all
records and the approval audit in one transaction. Concurrent/replayed decisions
cannot promote twice. A changed or invalid source must be rejected and corrected
in a new batch; the original remains intact. Authorization requires the actual
cemetery administrator assignment for every read, stage, download and decision.
Only system administrators can create a new cemetery.

## Deployment and validation

Apply migration 514 and refresh restricted API-role grants before publishing the
API/UI. Retain import source records with the resulting live data and backups.
Rollback application code first; dropping the batch table destroys source/review
provenance and is appropriate only before its imports have been accepted.

Rollback-only PostgreSQL fixtures cover creation, staging without live changes,
geometry parsing recovery, boundary errors, duplicate checks, stale/repeated
approvals, imported person evidence and audit provenance. HTTP tests reject
cross-cemetery and global-creation escalation before database access. Browser tests
cover file staging, acknowledgement/reason, retained conflict drafts, approval and
320px layout. Migration validation/rollback/reapply, lint, server suite and
production bundle checks are required.
