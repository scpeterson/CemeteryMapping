# ADR 0178: Model passageways as typed lot-layer areas

- Date: 2026-10-29
- Status: Accepted

## Decision and authorization

The owner approves the ten proposed passageways and the western D-P03 extension,
with the requirement that a gravesite deed can be assigned to a passageway just
as gravesites are assigned to lots. Use the existing lots table, UUID-based
assignment API and map layer with `area_type` equal to `lot` or `passageway`.
Store passage IDs as section plus P01/P02/P03. No gravesite or marker is renamed
or moved. Existing assignments and ownership records remain unchanged pending
review of a proposed assignment list.

Migration 502 adds the typed area and original-location-reference fields. Both
API and database refuse whole-area rights on passageways. Current and legacy
whole-lot event tables are protected, including changes to existing rights;
conversion of a lot with active whole-lot rights is refused. Individual
(gravesite-targeted) rights remain supported, including one deed listing multiple
gravesites. A person may own every individual gravesite without owning the
corridor. The five-gravesite lot limit remains for ordinary lots and is exempted
for passageways; an area-level lock serializes capacity and ownership checks.
This exemption does not establish burial capacity or grant burial permission.

Migration 503 creates A-P01, B-P01–P03, C-P01–P03 and D-P01–P03 from the approved
29 October review. Clip to the current section, subtract all preexisting active
lots, and require valid nonempty geometry. D-P03 extends west to the D/E edge;
its eastern extent remains the overlapping row extent. Operational boundaries
remain estimated, not surveyed. No provisional lot is reclassified as passageway.
Preserve 101 exact Original 2017/Updated 2022 location references, including
workbook, worksheet, cell, original wording and the earlier interpretation notes.
These are location evidence, not ownership rights. B and D have no confirmed
registry passage allocations in this crosswalk.

## User workflow

Select a gravesite, open Location and geometry, choose an entry labelled
Passageway in Assigned lot or passageway, and save the assignment. Open People
and ownership and Record deed or transfer. Choose This gravesite or Listed
gravesites. This whole lot is unavailable for a passageway. A deed applies to
selected gravesites and remains linked through their passageway assignments.
Passageway detail shows the individual-rights rule, assigned gravesites and
original registry references. Search, selection and visibility use the lot layer.

## Validation, deployment and recovery

Run `npm run lint`, `npm run build`, `APP_ENV=test npm run test:server`, and
`APP_ENV=test node --test scripts/passageways.integration.mjs`. Browser tests
cover desktop and phone assignment and deeds alongside existing lot/ownership
regressions. PostgreSQL fixtures test both whole-area ownership entry paths,
conversion guards, ordinary lot capacity, more than five individual passageway
gravesites, ten valid nonoverlapping areas, all 101 references, and the actual
assignment/deed APIs. Rehearse migrations on DEV in a rollback transaction and
compare protected-table hashes and all existing lots. Back up before application
and repeat those checks afterward. The API startup contract requires migration
502. Hosted TEST deployment needs separate authorization. Recovery uses the
backup or a reviewed forward correction; automatic rollback is empty so linked
gravesites and provenance are not silently removed.
