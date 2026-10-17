---
---

# ADR 0042: Split Reviewed Section C Shared-Marker Gravesites

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-08-27

## Context

The original headstone GPS import represented one spreadsheet coordinate as one marker point and one estimated gravesite polygon. Later field and inscription review showed that several Section C couple markers name two people buried in separate north/south gravesites. Keeping both burial rows assigned to the original gravesite incorrectly represented two physical burial spaces as one.

The GPS point is observed marker evidence. The surrounding gravesite polygons are estimated operational geometry and may be adjusted when reviewed evidence supports separate burial spaces. The correction must preserve the marker point, retain stable identifiers where possible, and make the shared physical marker's relationship to both gravesites explicit.

## Decision

Apply the reviewed north/south split pattern in Liquibase migrations 341 through 346, 348 through 350, 353, and 355 through 364:

| Migration | Original southern gravesite | New northern gravesite | Fixed shared marker |
| --- | --- | --- | --- |
| 341 | `C-0367`, Edmund Kohler | `C-0367A`, Marie Kohler | `TLC-HS-0367` |
| 342 | `C-0374`, James A Proie | `C-0374A`, Evelyn C Proie | `TLC-HS-0374` |
| 343 | `C-0379`, Albert D Hieber | `C-0379A`, Ida C Hieber | `TLC-HS-0379` |
| 344 | `C-0380`, Adam Sandrock | `C-0380A`, Clara B Sandrock | `TLC-HS-0380` |
| 345 | `C-0381`, H Carl Brandt | `C-0381A`, Alice R Brandt | `TLC-HS-0381` |
| 346 | `C-0382`, William DeWitt DeCourcy | `C-0382A`, Louise Hamilton DeCourcy | `TLC-HS-0382` |
| 348 | `C-0421`, Scott Simpson | `C-0421A`, Lynn Simpson (sold/pre-need) | `TLC-HS-0421` |
| 349 | `C-0389`, George Wolfarth | `C-0389A`, Catherine O Wolfarth | `TLC-HS-0389` |
| 350, 352 | `C-0392`, Elmer B Kaelin | `C-0392A`, Elizabeth A Kaelin | `TLC-HS-0392` |
| 353 | `C-0395`, Arthur Dennis Wochley | `C-0395A`, Luceil Wochley | `TLC-HS-0395` |
| 355 | `C-0398`, George William Luster | `C-0398A`, Mary L Luster | `TLC-HS-0398` |
| 356 | `C-0419`, Ralph C Magee | `C-0419A`, Jeannette B Magee | `TLC-HS-0419` |
| 357 | `C-0401`, Harold B Kivlan | `C-0401A`, Grace C Kivlan | `TLC-HS-0401` |
| 358 | `C-0402`, Constance Pagano | `C-0402A`, Pat Pagano | `TLC-HS-0402` |
| 359 | `C-0403`, George J Bohn | `C-0403A`, Emma E Bohn | `TLC-HS-0403` |
| 360 | `C-0409`, James T Fisher | `C-0409A`, Arlie D Fisher | `TLC-HS-0409` |
| 361 | `C-0410`, Ralph S Eaglen | `C-0410A`, Elva Eaglen | `TLC-HS-0410` |
| 362 | `C-0413`, Theresa P Wolfarth | `C-0413A`, Raymond A Wolfarth linked to this marker | `TLC-HS-0413` |
| 363 | `C-0416`, Howard L Sarver | `C-0416A`, Ellen Clara Sarver | `TLC-HS-0416` |
| 364 | `C-0420`, Paul John Brasses | `C-0420A`, Alice M Brasses | `TLC-HS-0420` |

Each correction:

- retains the original gravesite and public identifier for the named southern burial;
- creates a new `A`-suffixed operational identifier for the northern burial;
- uses estimated 4-by-10-foot gravesite polygons oriented east from the marker area;
- leaves the observed headstone point unchanged;
- links the marker to both gravesites with `relationship_type = 'spans'`;
- preserves marker-to-burial links and existing burial facts, including unknown dates;
- asserts that the expected marker, gravesite, and uniquely identified burials exist before mutation; and
- records the interpretation in geometry source and notes fields.

Where necessary, the original gravesite polygon moves south so the fixed marker acts as the shared north/south boundary. A migration must check the proposed polygons against active neighboring gravesites before acceptance. No new reviewed overlap exception is required for migrations 341 through 345. Later migrations record existing mapped-spacing limitations where applicable; their reviewed north/south assignments control over overlapping estimated polygons.

## Rationale

This pattern separates physical burial spaces without moving surveyed marker evidence or replacing stable original identifiers. The `headstone_gravesites` relationship records what the shared marker physically spans, while each burial has one correct gravesite assignment. Versioned migrations make the correction repeatable in TEST, STAGE, and PROD and preserve the reviewed interpretation in source control.

## Consequences

The new `A` suffixes are operational identifiers created by reviewed repair; they are not NHG labels or proof that the historic cemetery used those suffixes. Map users will see two adjacent estimated gravesite polygons and one fixed marker spanning them.

Future corrections must not infer a second gravesite solely because two names appear on a marker. Review burial evidence, inscription context, neighboring geometry, and pre-need status first. A living or pre-need person may require a reserved or sold space rather than an occupied burial, and an unknown death date must remain unknown rather than being fabricated.

These migrations use empty rollback declarations because reversing a reviewed authoritative data correction could discard subsequent edits or relationships. Recovery should use a database backup or a forward-fix migration based on the current records.

## Migration 346 History Repair (2026-10-17)

Migration 346 was executed in DEV and hosted TEST on August 28, 2026, but its SQL and root include were missing from `main`. Restore the original changeset unchanged, between 345 and 347. Its Liquibase v9 checksum is `9:c000ed388b4420abf954b08bf3f2a4d1`. Existing execution history must remain intact so Liquibase validates and skips this changeset; do not clear checksums, delete its history row, or execute its SQL manually on an already corrected database. Fresh databases apply it when the source records exist and otherwise leave unrelated records unchanged.

Regression coverage pins the original SQL bytes and root include order. Database tests use disposable schemas and real Liquibase execution to verify the original split, preserved marker and burial links, source-data prerequisite failures, absent-source behavior, and checksum validation and skipping after subsequent edits.

The original correction places the pair one foot south of the marker-centered position to avoid C-0383. This history repair does not change the original geometry or lot assignments. Migration 473 addresses the small intersection with the neighboring schematic lot boundary as a separate forward correction.

## Migration 473 Lot Alignment (2026-10-17)

The deed registry lists William & Louise DeCourcy against lot 83, and the fixed shared marker lies inside C-83. DEV and hosted TEST both showed approximately 38.498 square feet of each 40-square-foot polygon in C-83 and 1.502 square feet in C-82. Keep both C-83 assignments. These lot boundaries are schematic, not surveyed ownership or burial boundaries.

Migration 473 translates only `TLC-GPS-0382` and `TLC-GPS-0382-01` west by 0.38 feet (4.56 inches), using EPSG:32617 for the metric translation. Both polygons then fit C-83 without new neighboring or mutual overlaps. Preserve their 4-by-10-foot dimensions, estimated operational classification, north/south arrangement and prior one-foot south offset, identifiers, burial facts, links, lot assignments, and the observed marker point. Preserve migration 346 and its checksum unchanged.

The migration skips databases without either source gravesite and skips an already contained pair on repeat execution. Partial pairs, changed assignments or dimensions, missing shared-marker links, later edits to the original footprints, and proposed containment or overlap failures require review before any mutation. Regressions reconstruct the historical split and check containment, preservation, repeat execution, and prerequisite failures using temporary tables.

C-0383 is outside migration 473. The subsequent review led to migrations 474/475, documented in [ADR 0108](0108-c0383-alignment-c0425-retirement.md): retire the C-0425 import artifacts and align C-0383 west within C-83. The existing C-0384 overlap remains for separate review. Do not shift the shared marker or change the lot grid to resolve this pair's schematic alignment. Recovery follows the backup/forward-correction policy above.

## Rebuild And Validation

Run:

```bash
APP_ENV=dev npm run db:validate
APP_ENV=dev npm run db:migrate
npm run lint
npm run test:server
APP_ENV=test npm run db:migrate
APP_ENV=test npm run test:db-rules
```

For every split, verify that the northern gravesite centroid has the greater latitude, each burial points to the intended gravesite, the marker has active `spans` links to both gravesites, the marker geometry is unchanged, and the resulting polygons introduce no unreviewed overlap.

## Update Triggers

Update this ADR if one of these assignments is corrected, the north/south split geometry changes, a marker is found not to span both gravesites, an operational suffix is replaced by a source-native identifier, or the application gains an audited UI workflow that replaces migration-based shared-marker splitting.
