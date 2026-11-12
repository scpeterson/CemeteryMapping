---
---

# ADR 0208: Refresh dependencies while retaining migration and compiler holds

- Status: Accepted
- Date: 2026-11-12

## Decision

Update routine npm and documentation dependencies and refresh the pinned Node 24,
nginx stable and cloudflared container images. Keep Liquibase **4.33.0**, TypeScript
**6.0.3**, and their existing Dependabot holds. Remove the obsolete block on React
Vite plugin 6.x now that the project already uses Vite 8.

Use Node **24.22.3** for reviewed local development via `.nvmrc`, require that patch
or newer within Node 24 through `engines`, and align `@types/node` with Node 24.
CI continues selecting current Node 24. Move Vite, its React plugin and concurrently
into development dependencies so the API image's production install excludes them.

Refresh the lockfile to body-parser 2.4.0 and qs 6.17.1 for production request-parser
security fixes, plus Zod 4.6.7 for development tooling. Scope minimatch 11.0.8
overrides to ESLint, its config-array dependency and typescript-estree: their
requested minimatch 10 versions are affected by GHSA-g3hv-75wg-m249. Do not globally
override ExcelJS's older minimatch consumers. Remove these scoped overrides when
upstream consumers request patched compatible versions. Lint and the full CI suite
must validate this major-version substitution before merge.

Routine direct updates are Vite 8.3.8, its React plugin 6.3.0, Playwright 1.65.0,
Lucide 1.72.0, concurrently 10.0.7, globals 17.14.0 and typescript-eslint 8.72.2.
Keep ExcelJS and the emnapi dependencies pending separate replacement/removal work.
Update jekyll-relative-links to 0.9.2 and compatible addressable, csv and
sass-embedded patches while retaining Jekyll's constrained dependency majors.

## MapLibre deferral

Retain MapLibre 6.16.0. With the updated toolchain, the trial 6.18.0 production
build exceeded both the 427 KiB map-runtime limit and the 701 KiB core limit
(701.41 KiB). Trial 6.17.0 passed the map-runtime limit but narrowly exceeded the
core limit (701.02 KiB). The existing 6.16.0 passes with the remaining updates.
Keep all bundle budgets unchanged; a MapLibre upgrade requires separate measured
performance work rather than expanding these limits as routine maintenance.

## Validation and rollout

Add a regression test that posts malformed gzip-compressed JSON, verifies a 400
response and verifies the same Express server can serve a subsequent valid request.
Run clean-install audits, lint, server/script and release-tool tests, documentation
build/link checks, production bundle checks and CI's database/browser suites.

Container-pin changes take effect on a subsequent deployment. Merging this change
does not update hosted TEST or Production. No database schema or record changes
are included. Recover dependency regressions by reverting this source/lockfile
update and rebuilding; retain normal deployment backups for any later rollout.
