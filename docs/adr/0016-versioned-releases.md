---
---

# ADR 0016: Version Application Releases with SemVer and Database Tags

- Status: Accepted
- Date: 2026-06-09
- Owners: Project maintainers
- Related changes: Version metadata and release workflow implementation

## Context

The application now has enough schema, data import, audit, and operational workflows that maintainers need to know exactly which code and database migration state is running in each environment. A commit hash alone is too low-level for normal release notes, and an application version alone is not enough because the database changelog is part of the deployed system.

## Decision

Use semantic application versions from `package.json`, Git tags, GitHub releases, and Liquibase database tags together:

- App versions use SemVer, such as `0.2.0`.
- Git tags use a `v` prefix, such as `v0.2.0`.
- GitHub Releases are created from the matching tag.
- `CHANGELOG.md` records human-readable release notes.
- Production-affecting release notes must list included PRs, migration range, data scripts, smoke tests, and rollback or forward-fix notes.
- Databases are tagged after successful migration with the same release tag through `npm run db:tag -- v0.2.0`.

The API exposes version metadata through `/api/version` and `/api/health`. The frontend injects the package version, git SHA, and build time through Vite build constants and shows them in the environment badge tooltip.

## Rationale

This keeps code, schema, and operational state tied together without requiring a heavyweight release management system. SemVer gives maintainers a friendly release label. Git tags make the exact code recoverable. Liquibase tags make the database migration state visible. The UI and API metadata make it easy to confirm what is running during support or smoke testing.

## Consequences

Release preparation should be a normal PR that bumps `package.json` and updates `CHANGELOG.md`. The Git tag should be created only after the release PR merges and CI passes.

Builds created without explicit `APP_VERSION`, `GIT_SHA`, or `BUILD_TIME` environment variables fall back to `package.json`, the current git commit, and the current build timestamp. Server runtime metadata can also be overridden with those environment variables in deployed environments.

## Rebuild Notes

Prepare a patch release:

```bash
npm run release:patch
```

Prepare a minor release:

```bash
npm run release:minor
```

Prepare a major release:

```bash
npm run release:major
```

After the release PR merges, tag the exact main commit:

```bash
git tag v0.2.0
git push origin v0.2.0
```

After migrating an environment database:

```bash
APP_ENV=stage npm run db:tag -- v0.2.0
APP_ENV=prod npm run db:tag -- v0.2.0
```

Verify the running app:

```bash
curl http://127.0.0.1:3001/api/version
curl http://127.0.0.1:3001/api/health
```

## Update Triggers

Update this ADR when release versioning changes, release tags use a different format, version metadata moves, database tagging changes, or deployment automation replaces the manual release flow.
