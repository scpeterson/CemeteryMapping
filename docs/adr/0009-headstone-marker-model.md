# ADR 0009: Model Headstones as Physical Markers Separate from Burials

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #13

## Context

A gravesite is a burial location. A burial is a person interred at or associated with that location. A headstone is a physical marker that can list one or more people and has its own condition, GPS coordinate, material, inscription, and inspection needs.

The application needs to track headstone condition without collapsing marker condition into either the gravesite or burial record.

## Decision

Add physical marker tables:

- `headstones`
- `headstone_burials`

`headstones` stores marker-level data:

- generated `headstone_id`
- optional `gravesite_uuid`
- marker type
- condition
- condition notes
- inscription
- material
- photo URL
- latitude and longitude
- PostGIS point geometry
- source properties
- last inspection date

`headstone_burials` links one physical marker to one or more burial records.

## Rationale

This model supports:

- One headstone listing multiple people.
- Multiple headstones at one gravesite if that is ever discovered.
- A burial with no known headstone.
- A headstone condition workflow independent of burial identity.
- Future inspection history without changing the gravesite or burial concepts.

## Consequences

The importer must create both the generated gravesite polygon and the headstone point. UI and API work can later expose headstone condition without changing the burial model.

The current schema stores current condition directly on `headstones`. A separate condition event/history table can be added later if inspection history becomes necessary.

## Rebuild Notes

Apply migration:

```bash
APP_ENV=test npm run db:migrate
```

Inspect tables:

```sql
SELECT count(*) FROM headstones;
SELECT count(*) FROM headstone_burials;
```

Suggested future condition values currently allowed by the check constraint:

- `excellent`
- `good`
- `fair`
- `poor`
- `damaged`
- `unknown`

## Update Triggers

Update this ADR when condition values change, inspection history is added, marker photos are modeled differently, marker-to-burial cardinality changes, or headstones become first-class API/UI objects.
