---
---

# ADR 0017: Preserve Historic Lot Map Observations as Reviewable Evidence

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-06-09

## Context

The deed registry and lot model need to reconcile several imperfect sources: 2017 deed registry rows, 2022 updated registry rows, investigation notes, current map geometry, headstone-derived gravesite polygons, and older scanned lot maps. The historic map scans at `/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png` and `/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png` show lot numbers and passageways, but they are not georeferenced and are not survey-grade.

The scans are still useful evidence. North and south appear to be reversed between the two scans, so orientation must be confirmed during review. For example, after accounting for that orientation issue, they appear to place `C-0168`, `C-0167A`, `C-0167B`, `C-0166A`, and `C-0166B` in Section C lot `70`; `C-0171B`, `C-0171A`, `C-0170`, and `C-0169` in Section C lot `51`; and `C-0172A` and `C-0172B` in the passageway between Section C lots `29` and `51`.

The original `C-0166` gravesite was created from the Geo-locations spreadsheet as one gravesite. Ruth and Charles Soergel died after NHG was published in 1997 under Library of Congress Catalog Card #97-68576, so NHG has no entry for them and there likely was no headstone there when NHG was published. A later field photo shows one shared headstone for both gravesites, so `C-0166` was split into `C-0166A` and `C-0166B`.

Current `A` and `B` gravesite suffixes are evidence-based splits from one original gravesite record. They have been used when later evidence showed two separate gravesites because a burial occurred after NHG publication, because a couple headstone spans two gravesites, or both. `C-0172A` and `C-0172B` are an example of a shared couple headstone where only one person predates NHG publication: James H. Simpson died in 1995 and is listed in NHG, while Ruth F. Simpson died in 2011, after NHG publication, and is in a separate gravesite using the shared headstone.

Reviewed shared-marker repairs through `C-0236` retain the original gravesite for one burial or interment, create a northern letter-suffixed gravesite for the other burial or pre-need marker record, and keep the observed marker point fixed with a `spans` relationship to both gravesites. These suffixes are operational repair identifiers rather than labels transcribed from NHG.

Lot numbers are also not globally unique. Historic records distinguish areas such as OC and NA, so a lot number must be interpreted with cemetery-area or section context.

## Decision

Add `historic_lot_map_gravesite_evidence` as an audited review table for historic scan observations. Each row links a current gravesite to a source scan observation and can optionally link to a known production lot. The table stores:

- source scan name, path, and detail
- cemetery and gravesite references
- optional lot reference and text lot identifier
- relationship type, including `lot` and `passageway_between_lots`
- passageway boundary lot identifiers when applicable
- confidence, review status, and notes

Migration `059-historic-lot-map-evidence.sql` seeds the known Section C observations from the two historic scans as `staged` evidence. It does not update production gravesite lot assignments or geometry.

## Consequences

Historic map observations become queryable, reviewable, and auditable without overstating their precision.

Future deed and lot workflows can compare 2017 registry entries, 2022 registry entries, investigation notes, current lots, gravesites, and historic map observations before deciding whether to promote a lot relationship.

Passageway observations can be represented directly instead of forcing a gravesite into one neighboring lot.

Promotion still needs a deliberate workflow or reviewed script. A source observation row by itself is not final proof of lot ownership, burial right, or Council approval.

## Rebuild And Validation

Run:

```bash
npm run test:server
npm run lint
npm run build
APP_ENV=test npm run db:validate
```

When a database is available, also apply the migration in TEST and confirm staged evidence rows exist for the Section C observations.

## Update Triggers

Update this ADR if historic lot map evidence becomes a promoted production lot assignment workflow, if additional relationship types are needed, if scanned maps are georeferenced into a spatial lot layer, if the shared-marker split convention changes, or if duplicate lot-number handling changes.
