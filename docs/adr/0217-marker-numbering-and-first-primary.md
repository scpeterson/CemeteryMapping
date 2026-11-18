---
---

# ADR 0217: Marker numbering and first-primary defaults

- Status: Proposed
- Date: 2026-11-18

## Decision

The first marker added to a gravesite defaults to Primary marker. Additional
markers in other sections retain Footstone when available, otherwise Secondary
marker, and those sections retain their permitted types and multiple markers.
Section G permits zero markers or one primary flat marker per gravesite. It
rejects secondary, footstone, spanning, nearby and inferred relationships. The
form offers only Primary marker and Flat marker, and disables Add marker when a
marker exists; database validation protects stale forms and other mutation paths.
A gravesite and its burials may exist without any monument or marker.

Leave Marker ID blank to allocate an identifier when the insert commits. Migration
520 adds an insert trigger which serializes marker creation, infers the cemetery's
most common existing numeric prefix and padding (ties sort by prefix), and advances
past all existing numbers for that prefix, including deleted markers and other
cemeteries sharing the prefix. Trinity therefore continues `TLC-HS-…` across all
sections; G-015 does not imply TLC-HS-0015. New cemeteries without numeric marker
IDs use cemetery-name initials plus `-HS-` and four digits. Explicit IDs remain
available, subject to the global unique constraint. No existing ID is rewritten.
The new-gravesite/new-monument flow uses the same allocator.

Deferred triggers validate the final active marker/grave relationships, including
legacy direct references with no active explicit link. The internal
`section_g_primary_marker_claims` primary key and grave-row locking protect
concurrent writers. Checks cover insert/update/delete of links and markers,
restoration, grave section changes and section renaming. The runtime API cannot
write claim rows directly; security-definer trigger functions maintain them with
an explicit search path and no public execution grant. The migration refuses
existing conflicting G markers or relationships instead of choosing a survivor or changing data.

## Validation and deployment

Use `scripts/marker-defaults.integration.mjs` for transactional fixtures and
concurrent writers. Browser regressions cover first/additional defaults in A/G,
the single-primary Flat Marker restriction, blank-ID saves and the allocated identifier returned
by the server. API validation accepts blank IDs and rejects oversized explicit
IDs; Section G conflicts return HTTP 409.

Rehearse migration 520 on a disposable database copy and check existing G records
before applying it. Do not edit earlier migrations or clear checksums. Existing
records, geometry, burials, inscriptions and marker links remain unchanged.
Rollback removes the new triggers/functions and derived claim table; it does not
renumber committed markers or remove created marker records. Rolling back code
alone restores the previous defaults and requires manually entered IDs. Hosted
TEST/DEV deployment is separate from this PR.
