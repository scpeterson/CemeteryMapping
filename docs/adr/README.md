# Architecture Decision Records

[Documentation Home](../index.md)

This directory is the decision log for Cemetery Mapping. ADRs explain what was decided, why it was chosen, what tradeoffs it created, and how a future maintainer can rebuild or change the system without access to the original implementer.

## Rules

- Every architectural, data-model, import, deployment, or workflow decision that changes system behavior must add or update an ADR in the same PR.
- Do not silently rewrite accepted ADR history. If a decision changes materially, add a new ADR that supersedes the older one.
- Keep data origins auditable. When a source is uncertain, add a placeholder and mark it `TBD`.
- Include exact software versions when the decision depends on a tool, runtime, database, library, or container image.
- Include rebuild commands and validation steps.

## Status Values

- `Proposed`: under discussion or not yet implemented.
- `Accepted`: implemented or intentionally adopted.
- `Superseded`: replaced by a later ADR.
- `Deprecated`: no longer recommended but not fully replaced.

## Index

- [ADR 0001: Use a Vite React TypeScript Frontend](0001-vite-react-typescript-frontend.md)
- [ADR 0002: Use an Express API Backed by PostgreSQL and PostGIS](0002-express-postgres-postgis-api.md)
- [ADR 0003: Manage Schema Changes with Liquibase](0003-liquibase-schema-management.md)
- [ADR 0004: Support DEV, TEST, STAGE, and PROD Environments](0004-environment-model.md)
- [ADR 0005: Load Summary Map Geometry Before Grave Details](0005-summary-map-detail-api-flow.md)
- [ADR 0006: Use Staging and Validation for Spatial Imports](0006-spatial-import-staging-validation.md)
- [ADR 0007: Import Cemetery and Section Geometry from an Esri File Geodatabase](0007-file-geodatabase-cemetery-section-import.md)
- [ADR 0008: Generate Gravesites and Headstones from Headstone GPS Spreadsheet Rows](0008-headstone-spreadsheet-import.md)
- [ADR 0009: Model Headstones as Physical Markers Separate from Burials](0009-headstone-marker-model.md)
- [ADR 0010: Use CI to Validate Rebuildability](0010-ci-rebuild-validation.md)
- [ADR 0011: Secure Access with RBAC, Soft Deletes, and Audit Logging](0011-security-rbac-soft-delete-audit.md)

## Creating a New ADR

1. Copy [ADR 0000: Title](0000-template.md).
2. Name the new file with the next sequence number and a short slug.
3. Set `Status: Proposed` while designing.
4. Move to `Status: Accepted` in the PR that implements the decision.
5. Add the ADR to this index.
6. Update any affected rebuild notes or data source placeholders.

## Software Inventory

The main software choices are captured in the ADRs. Exact JavaScript dependency versions come from `package-lock.json`; container image versions come from `docker-compose.yml`; CI runtime versions come from `.github/workflows/ci.yml`.

Current core versions as of 2026-05-20:

| Component | Version | Source |
| --- | --- | --- |
| Node.js in CI | 24 | `.github/workflows/ci.yml` |
| React | 19.2.6 | `package-lock.json` |
| React DOM | 19.2.6 | `package-lock.json` |
| Vite | 7.3.3 | `package-lock.json` |
| TypeScript | 5.9.3 | `package-lock.json` |
| Express | 5.2.1 | `package-lock.json` |
| pg | 8.20.0 | `package-lock.json` |
| MapLibre GL JS | 5.24.0 | `package-lock.json` |
| ExcelJS | 4.4.0 | `package-lock.json` |
| PostgreSQL/PostGIS image | `postgis/postgis:16-3.4` | `docker-compose.yml` |
| Liquibase image | `liquibase/liquibase:4.33.0` | `docker-compose.yml` |
| Playwright | 1.60.0 | `package-lock.json` |
| ESLint | 9.39.4 | `package-lock.json` |

## Rebuild Checklist

Use this checklist when verifying that the documentation is still enough to rebuild the system:

```bash
npm ci
npm run db:up:test
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:rollback:test
APP_ENV=test npm run db:migrate
APP_ENV=test npm run db:seed:demo
npm run lint
npm run build:test
APP_ENV=test npm run test:e2e
```

For real cemetery data imports, see ADR 0007 and ADR 0008 before running import commands.
