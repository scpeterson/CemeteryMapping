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
| `actions/checkout` | v6 | Checkout repository |
| `actions/setup-node` | v6 | Install Node.js and configure npm cache |
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
8. `npx playwright install --with-deps chromium`
9. `npm run lint`
10. `npm run build:test`
11. `npm run test:e2e`
12. `npm run db:down`

## Rationale

CI verifies the exact rebuild path from a clean checkout. Running rollback tests catches migration mistakes before merge. Running e2e tests against a migrated and seeded PostGIS database verifies the frontend/API/database integration.

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
npm run build:test
APP_ENV=test npm run test:e2e
APP_ENV=test npm run db:down
```

## Update Triggers

Update this ADR when CI runner versions, Node.js version, workflow steps, test database image, migration validation, or e2e testing strategy changes.
