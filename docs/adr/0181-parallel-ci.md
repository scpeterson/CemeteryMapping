---
---

# ADR 0181: Parallel CI with a documentation-only PR path

- Date: 2026-10-29
- Status: Accepted

## Decision

Keep `Lint, build, and test` as the required aggregate check used by branch
protection and hosted TEST deployment. Run lint/unit tests/builds, database and
Docker checks, and four Chromium shards concurrently on separate runners. Each
browser shard migrates and seeds its own PostGIS instance. Database integration
tests stay serial because their fixtures share schema state. Validate and replay
migration rollbacks before applying migrations and loading demo data.

Documentation-only PRs (all paths under `docs/`, or the explicitly listed root,
database and hosted TEST README/changelog files in `scripts/lib/ci-policy.mjs`)
run Jekyll, changed-page local link checks, rendered dependency checks, and archive
manifest integrity validation. Deleted and renamed paths participate in classification;
unknown files and empty diffs use full application validation. Every push to main
runs the full application checks, including documentation-only merges. Documentation
validation also runs whenever recognized documentation changes accompany code.
Existing untouched pages are not subject to a new repository-wide link gate.

The aggregate runs even when dependencies fail or are skipped. It accepts skipped
jobs only when classification explicitly excludes them, and otherwise requires
success from every applicable job, including the complete browser matrix.
Superseded PR runs are canceled; main runs have unique concurrency groups.

Cache Chromium binaries by runner OS/architecture and package-lock hash. Always
install browser OS dependencies. Cache Docker BuildKit layers using dependency and
Dockerfile keys with revision-specific saves. The startup check uses `buildx --load`
when `DOCKER_STARTUP_CACHE` is set; ordinary local execution still uses `docker build`.
Replace the local layer cache after a successful build to avoid unbounded growth.
Only the fixed dummy mode-0600 build fixture enters cached layers. Runtime database
credentials remain in the separate temporary environment file and never enter the
build context. Keep the default-user, file ownership/mode and API health assertions.

## Validation and consequences

The previous measured run took 10m35s, including 8.2 minutes for 262 browser tests
on two workers. Four shards each use two workers; actual elapsed improvement must
be measured in GitHub, including runner queue and database startup overhead.
Parallel jobs use more runner capacity and repeat dependency/database setup.

Run lint, server and deployment tests, both builds, workflow syntax validation,
Jekyll/link/hash checks, and list all four Playwright shards to check complete,
disjoint test coverage. Exercise the Docker startup check with a cold and warm
BuildKit cache. Policy tests reject failed, canceled, missing and unexpectedly
skipped dependencies. The first hosted CI run remains the end-to-end verification
of GitHub expressions, caches, isolation and aggregate behavior.

Revert the workflow, shared action, policy helpers and optional Docker cache path
to restore serial CI. No database migration or application restart is needed.
