# ADR 0212: PostGIS 3.7 with legacy TIGER restore compatibility

- Status: Accepted
- Date: 2026-11-14

## Context

PR #848 updates PostGIS 3.6.4 to 3.7.0 on PostgreSQL 18.6. Existing application
clusters contain `postgis_tiger_geocoder` 3.6.4, while upstream 3.7 moved TIGER
into a separate project. A stock image cannot restore those dumps. The bulk
`postgis_extensions_upgrade()` helper also attempts a nonexistent TIGER 3.7.0
upgrade when that legacy extension is present.

## Decision

Build one compatibility image for root DEV/TEST/STAGE/PROD and hosted TEST from
pinned upstream digests. Copy only the SQL-only TIGER extension files from the
previous image; keep core SQL and all shared libraries from 3.7. Explicitly update
core PostGIS and installed topology, retaining TIGER at 3.6.4. Preserve PostgreSQL
18 mount roots, named volumes and database access controls.

Follow the [database upgrade procedure and rehearsal evidence](../postgresql-18-upgrade.md#postgis-36-to-37-within-postgresql-18).
Image changes alone do not update installed extension SQL. Existing environments
require separately scheduled, backed-up database maintenance.

## Consequences

Pre-upgrade TIGER data and functions remain restorable without dropping extension
objects. The donor is intentionally pinned and requires manual dependency/security
review. Moving to a maintained standalone TIGER release is a separate change.
The SQL-only compatibility layer is covered by same-volume upgrade and logical
restore tests, including address normalization and non-extension TIGER user data.
The disposable real-data rehearsal preserved all application tables and API output;
surrounding geometry issues remain outside this change.
