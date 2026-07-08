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
- design notes for carved, attached, or other decorative flourishes
- back-side description
- material
- normalized material type code
- photo URL
- latitude and longitude
- PostGIS point geometry
- source properties
- last inspection date

`marker_types` and `marker_material_types` provide controlled lookup values for marker form and material. Lookup tables use UUID primary keys, while lowercase `code` values remain unique stable identifiers for seed data, imports, and compatibility. The seed values are based on common cemetery/monument categories and VA marker categories, including upright headstones, flat or flush markers, bevel markers, slant markers, ledgers, monuments, footstones, plaques, benches, niche markers, medallions, granite, gray granite, pink granite, red granite, marble, white marble, bronze, limestone, sandstone, slate, concrete, metal, wood, ceramic or porcelain, glass, zinc, unknown, and other.

`headstone_condition_types` provides controlled lookup values for marker condition: excellent, good, fair, poor, damaged, and unknown.

`headstone_gravesites` links one physical marker to one or more gravesites. `headstones.gravesite_uuid` remains as a compatibility anchor for the primary gravesite, while `headstone_gravesites` is the relationship table to use when a marker spans, is near, or is inferred to relate to additional gravesites. The relationship type also distinguishes footstones and other secondary markers from the primary marker relationship.

Current marker-to-gravesite relationship values are:

- `primary`
- `spans`
- `nearby`
- `inferred`
- `footstone`
- `secondary`

`headstone_burials` links one physical marker to one or more burial records.

`headstone_relationships` links one physical marker to another physical marker. This is used for cases such as family obelisk references, markers on a common base, foot markers, and other explicit marker references found during field review or in source text. It is not a substitute for marker-to-gravesite or marker-to-burial links. Plot markers should first be represented as marker records when they have locations; gap notes remain source observations rather than marker relationships.

## Rationale

This model supports:

- One headstone listing multiple people.
- Multiple headstones at one gravesite if that is ever discovered.
- One headstone associated with multiple gravesites.
- Secondary markers or footstones for a gravesite.
- One marker explicitly referencing another marker, such as an obelisk or foot marker relationship.
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

## Media Evidence

Marker photos are now modeled through general media evidence instead of only `headstones.photo_url`. The `photo_url` field remains for compatibility with earlier imported or manually entered URLs, while new field collection should create `media_assets` rows linked through `headstone_media_assets` and, when appropriate, `gravesite_media_assets`.

This keeps photo files outside Postgres, allows one photo to document multiple cemetery records, and preserves future flexibility for documents, scans, maps, and staged or review-needed images. Local uploads currently write to `uploads/media` by default and can be moved with `MEDIA_UPLOAD_DIR`; any production deployment needs durable file storage or object storage in addition to database backups.

## Update Triggers

Update this ADR when condition values change, marker type/material lookup values change materially, inspection history is added, marker photos are modeled differently, marker-to-burial or marker-to-gravesite cardinality changes, or headstones become first-class API/UI objects.
