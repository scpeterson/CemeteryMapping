---
---

# ADR 0043: Retire C-0424 as a Military Foot-Marker Placeholder

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-28

## Context

The headstone spreadsheet import generated C-0424 and a burial named `Louis Herman's Military Placard` from marker TLC-HS-0424. Field review established that TLC-HS-0424 is a flat military foot marker for Louis Herman Wolf, whose real burial is in C-0423 under couple monument TLC-HS-0423. C-0424 is not a physical burial space and will never contain a burial.

The application already records a high-confidence active `foot_marker` relationship from TLC-HS-0424 to TLC-HS-0423. Keeping the generated gravesite and non-person burial would incorrectly imply another available or occupied burial space.

## Decision

Migration 347:

- preserves TLC-HS-0424 and its observed point geometry;
- preserves the active foot-marker relationship from TLC-HS-0424 to TLC-HS-0423;
- links TLC-HS-0424 to C-0423 with the `footstone` marker-to-gravesite relationship;
- changes the marker's compatibility `gravesite_uuid` anchor from C-0424 to C-0423;
- links TLC-HS-0424 to the canonical Louis Herman Wolf burial in C-0423;
- soft-deletes the old marker links to the non-person placard burial and C-0424;
- soft-deletes the `Louis Herman's Military Placard` placeholder burial; and
- soft-deletes C-0424 rather than retaining it as an unusable gravesite.

The migration asserts that C-0424 has no ownership, media, maintenance, feature, NHG, historic-map, or source-person dependencies before retiring it.

## Rationale

A military foot marker is a physical marker associated with a real burial and gravesite; it is not a separate burial or burial space. Preserving the marker, its coordinates, and its relationship to the main monument retains the field evidence while removing generated operational records that misstate cemetery capacity.

Soft deletion preserves auditability and allows a forward fix if later evidence contradicts the field review. Linking both the gravesite and canonical burial ensures the military marker appears with Louis Herman Wolf without conflating it with the couple monument.

## Consequences

C-0424 no longer appears in normal map, search, availability, or burial-space results. TLC-HS-0424 remains active and appears as a footstone for C-0423 and as a foot marker related to TLC-HS-0423. Louis Herman Wolf remains the only person represented by the military placard record.

Future imports and manual corrections must not create a burial row whose name describes a marker, plaque, monument, or placard rather than a person. Additional military plaques should link to the canonical burial and gravesite using marker relationships.

## Rebuild And Validation

Run:

```bash
APP_ENV=dev npm run db:validate
APP_ENV=dev npm run db:migrate
npm run lint
APP_ENV=test npm run db:migrate
APP_ENV=test npm run test:db-rules
```

Verify that C-0424 and the placeholder burial are soft-deleted; TLC-HS-0424 retains its geometry; its primary and active footstone links point to C-0423; it is linked to Louis Herman Wolf; and the TLC-HS-0424 to TLC-HS-0423 `foot_marker` relationship remains active.

## Update Triggers

Update this ADR if field evidence establishes a real C-0424 burial space, TLC-HS-0424 belongs to a different burial, the marker-to-marker relationship direction changes, or marker placeholders become a supported operational record type.
