---
---

# ADR 0193: Use the PostgreSQL 18 volume root and preserve legacy clusters

- Date: 2026-10-30
- Status: Accepted

## Decision

PR #748 changed the root Compose database to postgis/postgis:18-3.6 but retained
the pre-18 mount at /var/lib/postgresql/data. The 18 image rejects that unused
mount even when empty, so CI never reached migrations. Mount the same named
volume at /var/lib/postgresql instead; the image uses 18/docker beneath it.
Keep volume identities unchanged: the upstream entrypoint detects a PG_VERSION
at the old cluster root and refuses startup rather than hiding old data behind
an empty new cluster. Do not copy files, rewrite PG_VERSION or delete volumes.

Existing clusters require a rehearsed logical dump/restore into a separate volume.
The local Compose override selects the new volume explicitly and is ignored by
Git. The upgrade guide documents backup, role grants, validation and recovery.
The separately pinned hosted TEST image and mount remain PostgreSQL 17; no live
environment is upgraded by this change.

## Validation and recovery

Run lint, server tests and node --test scripts/postgres18-startup.integration.mjs.
Disposable Docker fixtures reproduce the legacy-mount error, validate the Compose
mount with fresh 18/PostGIS 3.6, reject a 17 cluster, reopen it on 17 with its row
intact, then dump/restore that spatial row to 18 and verify it after restart.
A separate local logical restore of the existing TEST database retained all 808
graves with identical geometry fingerprints and matching burial, headstone, media
and current-owner counts. The source database was read only; the destination was
a disposable PostgreSQL 18 container.

The database CI job runs this regression through test:db-rules alongside complete
Liquibase migration/rollback, API and spatial integrity checks.

Before new writes, recovery uses the old checkout/image/mount and retained old
volume. After new writes, reconcile those edits before any fallback; the old
cluster is a pre-cutover snapshot. See [the upgrade guide](../postgresql-18-upgrade.md)
and [upstream entrypoint](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh).
