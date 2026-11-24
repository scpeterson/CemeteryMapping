---
---

# ADR 0222: Managed local runtimes and environment parity

Date: 2026-11-24

Status: Accepted

## Context

DEV and local TEST used temporary processes, stale release metadata and shared
frontend build output. Their database versions matched hosted TEST, but local
containers referenced image IDs whose image metadata was missing. Manual parity
and data refresh work needed a maintained verification entry point and explicit
recovery boundaries. A cached local TEST session also concealed an unregistered
port-5174 Auth0 callback.

## Decision

Provide a macOS LaunchAgent-backed local runtime command with separate API/web
ports, private authenticated profiles, exact revision/build metadata, and paired
process supervision. TEST captures API/shared source alongside a dedicated Vite
build; root `dist` is no longer its deployment directory. Dependencies remain
lockfile-installed in the checkout, requiring rebuild/restart after `npm ci`.
DEV remains a working-tree/HMR environment. Do not kill unknown port owners.

Recreate local database containers from the existing digest-pinned compatibility
image using their original named volumes, after full logical/cold backups and
whole-cluster fingerprint checks. Preserve users, credentials and historical DBs.

Maintain a read-only Python parity command comparing business rows including
history and EWKB, schema/functions/extensions, source/dependency configuration and
media content. Report runtime metadata separately; exclude user/access/operational
history and migration ledger rows from business equality. Fail on drift or
incomplete audits. Use authorized SSH for hosted origin probes; public edge/login
checks remain separate.

Document a backup-first, reviewed and rehearsed DEV-to-TEST refresh procedure.
Do not provide unattended full-database replacement. Keep protected identities,
access settings, secrets and append-only audit history environment-specific.

## Consequences

Local TEST starts independently of DEV and survives child process failure.
Build directories and private profiles are ignored. Reproducible checks provide
private fingerprint evidence without publishing raw data or credentials. They
are point-in-time checks, not global transaction snapshots or physical-phone
validation. Fresh sign-in requires the TEST client's exact 5174 callback, logout
and web-origin URLs; a cached session is insufficient.

Hosted storage cleanup remains guarded by the existing encrypted retention
policy. Separately reviewed old container images may be removed only after
content-verified recovery archives, retaining current/four recent releases,
manual rollback holds and all data volumes.
