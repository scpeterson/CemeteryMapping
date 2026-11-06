---
---

# ADR 0198: Protect record editors against concurrent changes

- Status: Accepted; not deployed
- Date: 2026-11-05
- Related: [ADR 0197](0197-delegated-cemetery-members.md)

## Decision

Extend existing gravesite, marker-face, inspection and full ownership-editor
revision checks to burial details, marker details, quick owner edits, profiles
and system account administration. Return an opaque version in their read
responses. Each form captures that version when opened and sends it with its
save. Never obtain a new version from a shared cache while retaining an old draft.

Public edit routes require `expectedVersion`; missing/invalid tokens return 400
with reload guidance. Lock the authoritative rows inside the existing audited
transaction, then compare the version before any mutation. A stale token returns
409 and rolls back all changes. Trusted import/fixture repository calls may omit
the token inside their own transaction; any supplied token is always checked.

Burials, marker metadata and profiles use the underlying PostgreSQL row's `xmin`.
Marker CTEs explicitly retain that system column. Quick owner edits lock the event
before its party and compare both row identities. System user versions include
the account row and a digest of its membership row identities, so delegated
membership edits cannot be overwritten by an older Users form. Membership and
system account workflows share the account-row lock. No migration or database
role grant change is required.

Inspection-only saves retain their per-inspection `expectedUpdatedAt` guard, and
full ownership edits retain their aggregate `expectedRevision`. A new inspection
does not fail simply because unrelated marker metadata changed. Existing
face-revision and linked-photo guards remain authoritative.

## Recovery and compatibility

A 409 preserves all form edits. The explicit **Reload latest values (discard
edits)** action asks for confirmation, fetches a fresh authorized read and resets
the baseline only on success. Cancel or a failed reload preserves the draft.
Read endpoints for individual burials, scoped owner edits and system users support
this recovery without an unbounded directory download.

Update third-party edit clients alongside this release to retain and submit the
new token. Tokens are opaque short-lived concurrency markers, not timestamps or
portable identities. Reload after database recovery, and resolve stale offline
drafts explicitly rather than removing their version checks.

## Validation

Independent PostgreSQL connections race the same captured snapshots for burials,
markers, quick owners, system accounts and profiles: exactly one writer succeeds,
the other receives a conflict, and the winning data remains. Writable fixtures
live in a disposable schema; cemetery source records remain read-only. Account
tests also change a delegated membership without updating the account row and
verify that the older system account form cannot replace it. HTTP tests reject
missing versions before querying data. Browser regressions cover retained edits,
cancelled/confirmed reload and saving with the refreshed token.
