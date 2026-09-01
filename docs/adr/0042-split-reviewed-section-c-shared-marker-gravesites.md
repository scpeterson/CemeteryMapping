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

Apply the reviewed north/south split pattern in Liquibase migrations 341 through 345, 348 through 350, 353, and 355 through 364:

| Migration | Original southern gravesite | New northern gravesite | Fixed shared marker |
| --- | --- | --- | --- |
| 341 | `C-0367`, Edmund Kohler | `C-0367A`, Marie Kohler | `TLC-HS-0367` |
| 342 | `C-0374`, James A Proie | `C-0374A`, Evelyn C Proie | `TLC-HS-0374` |
| 343 | `C-0379`, Albert D Hieber | `C-0379A`, Ida C Hieber | `TLC-HS-0379` |
| 344 | `C-0380`, Adam Sandrock | `C-0380A`, Clara B Sandrock | `TLC-HS-0380` |
| 345 | `C-0381`, H Carl Brandt | `C-0381A`, Alice R Brandt | `TLC-HS-0381` |
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
