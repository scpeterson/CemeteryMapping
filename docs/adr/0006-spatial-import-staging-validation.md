---
---

# ADR 0006: Use Staging and Validation for Spatial Imports

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #8, PR #10, PR #13

## Context

Real cemetery spatial data can arrive from GIS sources with different schemas, geometry types, topology quality, coordinate systems, and naming conventions. The application needs to review imported geometry before promoting it to production tables.

## Decision

Use staging tables for spatial imports and a validation view for topology-like checks.

Staging tables:

- `spatial_import_batches`
- `spatial_import_features`

Validation view:

- `spatial_validation_issues`

Validation command:

```bash
npm run db:validate:spatial
```

Validation uses severities:

- `error`: blocks promotion or causes validation command failure.
- `warning`: visible for review but not blocking.

## Rationale

Staging preserves source metadata and raw feature identities before the application commits to normalized production tables. The validation view makes topology-like rules inspectable in SQL and usable from scripts.

Warnings are necessary because real GIS data can contain tiny boundary slivers. For example, imported section polygons have sub-square-meter differences relative to cemetery geometry that should be reviewed but should not stop promotion.

Generated `TLC-GPS-*` gravesite rectangles from headstone GPS points are approximate placeholders, not surveyed grave polygons. Their overlaps are warnings until surveyed grave polygons are available.

## Consequences

Importers should load to staging when importing authoritative GIS layers. Promotion scripts must refuse staging batches with `error` rows.

Some data-quality conditions are deliberately visible as warnings. Maintainers must review warning counts instead of ignoring them entirely.

## Rebuild Notes

Validate spatial data:

```bash
APP_ENV=test npm run db:validate:spatial
```

Promote validated staging data:

```bash
APP_ENV=test npm run db:promote:spatial -- --batch-id <batch-uuid>
```

Known validation behavior:

- Invalid geometry is an error.
- Wrong geometry type is an error.
- Parent containment differences greater than 1 square meter are errors.
- Parent containment differences greater than 0 and up to 1 square meter are warnings.
- Generated `TLC-GPS-*` gravesite overlaps are warnings.

## Update Triggers

Update this ADR when validation rules, thresholds, staging tables, promotion rules, or severity behavior changes.
