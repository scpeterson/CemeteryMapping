---
---

# ADR 0016: Version Application Releases with SemVer and Database Tags

- Status: Accepted
- Date: 2026-06-09
- Owners: Project maintainers
- Related changes: Version metadata and release workflow implementation

## November 9, 2026: current release policy

This policy updates the original decision below; the original commands and
rationale remain historical context.

- Use `package.json` as the application version source and update the root
  versions in `package-lock.json` in the same release-preparation PR.
- Before 1.0, use patch releases for fixes and behavior-preserving refactors,
  and minor releases for new workflows or intentional breaking changes. Identify
  breaking changes, migration requirements and recovery limits explicitly.
  Documentation-only PRs do not require an application version bump.
- Reserve 1.0.0 for an agreed stable compatibility contract covering API payloads,
  supported workflows, exports and persisted/offline data. After 1.0, incompatible
  contract changes require a major version. A release number is not proof of
  production readiness or completion of pending verification.
- Release notes identify the exact source/tag, included PRs, schema baseline and
  migration range, data scripts, checks, known gaps and recovery instructions.
  Create a release-preparation PR, pass CI, merge, then wait for CI on the exact
  merged commit before creating an annotated `vX.Y.Z` tag and GitHub Release.
  Never move published tags or invent retrospective releases. New fixes receive
  a new version. Environment and build identity remain separate metadata.
- For hosted TEST, use `npm run deploy:test -- --ref v0.2.0` (or a full 40-character
  commit SHA). The command fetches the selected revision, requires it to be on
  `origin/main`, resolves it once, and checks CI for that exact commit. A version
  tag must match the selected package version. Omitting `--ref` retains the
  latest-main workflow; named releases should always use an explicit reference.
- Frontend metadata uses the selected package version, SHA and build timestamp.
  The release manifest records them; candidate and final health must match the
  version, SHA and timestamp. A stale hosted `APP_VERSION` override fails those
  checks rather than silently relabeling the release. Preserve private settings.
- The environment/version badge opens an in-application **What's new** panel for
  every role while retaining its technical hover details. Maintain plain-language
  notes in `src/data/releaseNotes.json`, keyed by the exact installed package
  version. Add that version's entry in the release-preparation PR; retain existing
  release entries. An unknown version shows an unavailable message, never notes
  for a different release. Bundled notes work without a GitHub account or a
  separate release-notes request. These user-facing summaries complement the
  changelog and operational verification records.
- Publishing or merging a release does not deploy it. Record each environment's
  actual version, SHA, build time and migration state after separate deployment.
  Database release tags require a separately authorized migration/promotion
  procedure; code-only TEST deployment does not migrate, restore, seed or tag
  the live database. A Git tag is not a database rollback instruction.

Start the named release history at **0.2.0**, retaining the existing accumulated
changelog as the initial baseline. Pending fresh Access/Auth0 login, invitation
delivery, live token replay and disconnected offline synchronization checks must
remain visible in the applicable release notes and runbooks until completed.
See the [hosted TEST workflow](../hosted-test.md#repeatable-deployment-command).

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
