---
---

# ADR 0009: Model Headstones as Physical Markers Separate from Burials

- Status: Accepted
- Date: 2026-05-20
- Owners: Project maintainers
- Related changes: PR #13, PR #83

## Context

A gravesite is a burial location. A burial is a person interred at or associated with that location. A headstone is a physical marker that can list one or more people and has its own condition, GPS coordinate, material, inscription, and inspection needs.

The application needs to track headstone condition without collapsing marker condition into either the gravesite or burial record.

## Decision

Add physical marker tables:

- `marker_types`
- `marker_material_types`
- `headstone_condition_types`
- `headstones`
- `headstone_gravesites`
- `headstone_burials`

`headstones` stores marker-level data:

- generated `headstone_id`
- optional `gravesite_uuid`
- marker type
- normalized marker type code
- condition
- normalized condition code
- condition notes
- inscription
- material
- normalized material type code
- photo URL
- latitude and longitude
- PostGIS point geometry
- source properties
- last inspection date

`marker_types` and `marker_material_types` provide controlled lookup values for marker form and material. The seed values are based on common cemetery/monument categories and VA marker categories, including upright headstones, flat or flush markers, bevel markers, slant markers, ledgers, monuments, footstones, plaques, benches, niche markers, medallions, granite, marble, bronze, limestone, sandstone, slate, concrete, metal, wood, ceramic or porcelain, glass, zinc, unknown, and other.

`headstone_condition_types` provides controlled lookup values for marker condition: excellent, good, fair, poor, damaged, and unknown.

`headstone_gravesites` links one physical marker to one or more gravesites. `headstones.gravesite_uuid` remains as a compatibility anchor for the primary gravesite, while `headstone_gravesites` is the relationship table to use when a marker spans, is near, or is inferred to relate to additional gravesites.

`headstone_burials` links one physical marker to one or more burial records.

## Rationale

This model supports:

- One headstone listing multiple people.
- Multiple headstones at one gravesite if that is ever discovered.
- One headstone associated with multiple gravesites.
- A burial with no known headstone.
- A headstone condition workflow independent of burial identity.
- A controlled marker type/material list without hard-coding an enum into application code.
- Future inspection history without changing the gravesite or burial concepts.

## Consequences

The importer must create both the generated gravesite polygon and the headstone point, plus a primary `headstone_gravesites` link. UI and API work can later expose headstone condition without changing the burial model.

The current schema stores current condition directly on `headstones`. A separate condition event/history table can be added later if inspection history becomes necessary.

## Rebuild Notes

Apply migration:

```bash
APP_ENV=test npm run db:migrate
```

Inspect tables:

```sql
SELECT count(*) FROM headstones;
SELECT count(*) FROM marker_types;
SELECT count(*) FROM marker_material_types;
SELECT count(*) FROM headstone_condition_types;
SELECT count(*) FROM headstone_gravesites;
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

Update this ADR when condition values change, marker type/material lookup values change materially, inspection history is added, marker photos are modeled differently, marker-to-burial or marker-to-gravesite cardinality changes, or headstones become first-class API/UI objects.
