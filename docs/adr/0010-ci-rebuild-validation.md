---
---

# ADR 0010: Use CI to Validate Rebuildability

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: GitHub Actions CI workflow

## Context

The project must remain rebuildable by a maintainer without access to the original implementer. Database migrations, rollback behavior, application builds, and browser behavior need automated verification on every pull request.

## Decision

Use GitHub Actions CI on pushes and pull requests to `main`.

CI software:

| Software | Version | Purpose |
| --- | --- | --- |
| GitHub Actions runner | `ubuntu-latest` | CI host |
| `actions/checkout` | v7 | Checkout repository |
| `actions/setup-node` | v7 | Install Node.js and configure npm cache |
| Node.js | 24 | Runtime for build, scripts, and tests |
| Playwright | 1.61.1 | Browser test runner |
| PostgreSQL/PostGIS image | `postgis/postgis:17-3.5` | Test database |
| Liquibase image | `liquibase/liquibase:4.33.0` | Migration validation |

CI steps:

1. `npm ci`
2. `npm run db:up`
3. `npm run db:validate`
4. `npm run db:rollback:test`
5. `npm run db:migrate`
6. `npm run db:seed:demo`
7. `npm run db:status`
8. `npx playwright install chromium`
9. `npm run lint`
10. `npm run test:server`
11. `npm run test:db-rules`
12. `npm run build:test`
13. `npm run test:e2e`
14. `npm run db:down`

## Rationale

CI verifies the exact rebuild path from a clean checkout. Running rollback tests catches migration mistakes before merge. Running e2e tests against a migrated and seeded PostGIS database verifies the frontend/API/database integration.

The synthetic demo seed is also a behavioral compatibility fixture. It must cover both section-scoped and block-scoped lots, variable lot dimensions, restricted lots, gravesites without lots, repeated lot numbers resolved with suffixes, and markers related to more than one gravesite and burial. Seed-time assertions should fail immediately if these representative relationships are lost.

## Consequences

PRs that change schema, scripts, frontend behavior, or API behavior must keep CI green. Long-running or external real-data imports are not run in CI; they must be documented in ADR rebuild notes and tested locally when relevant.

## Rebuild Notes

Run the CI-equivalent local flow:

```bash
npm ci
APP_ENV=test npm run db:up
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:rollback:test
APP_ENV=test npm run db:migrate
APP_ENV=test npm run db:seed:demo
APP_ENV=test npm run db:status
npm run lint
npm run test:server
APP_ENV=test npm run test:db-rules
npm run build:test
APP_ENV=test npm run test:e2e
APP_ENV=test npm run db:down
```

## Update Triggers

Update this ADR when CI runner versions, Node.js version, workflow steps, test database image, migration validation, e2e testing strategy, or the representative demo-fixture contract changes.

## Browser suite split

CI runs fixture browser specs on four shards with Vite and an unreachable API
proxy. The built offline field shell check stays on the first fixture shard.
A separate job provisions the seeded PostGIS database and runs `app.spec.ts`
as a group, including its real API search, delete/restore and admin checks.
The aggregate CI gate requires both browser jobs for application changes.

`npm run test:e2e` still runs the full suite. To select a group locally, use
`BROWSER_SUITE=fixture APP_ENV=test npm run test:e2e` or, with a migrated and
seeded disposable TEST database, `BROWSER_SUITE=database APP_ENV=test npm run test:e2e`.
A spec that requires live API or database behavior belongs in the database
group. Keep the fixture exclusion and database selection in sync through the
shared selector in the Playwright config.

Database setup took a median of 46 seconds per browser shard over 12 jobs.
Four fixture shards preserve test parallelism while the separate database job
incurs its own runner and Chromium setup. Measured wall-clock savings depend
on the new job distribution.

### Balance fixture shards by measured duration

Fixture CI assigns whole spec files to four shards. It places the longest
estimated file on the lightest shard first. The weights come from summed
Playwright case durations in CI run 45430329027. New files receive a
10-second estimate and are assigned automatically. Refresh the estimates
from recent passing fixture jobs when the shard durations drift.

The record photo spec is split into gallery/save/recovery, review/corrections,
and display preferences. The three files share the same fixtures. Locally,
`BROWSER_SUITE=fixture BROWSER_FIXTURE_SHARD=1 npm run test:e2e` runs the first
weighted shard. Omit the shard selector to run the entire fixture suite.
