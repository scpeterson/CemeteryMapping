---
---

# Synthetic Cemetery Data Coverage Plan

Assessment date: September 28, 2026. Status: proposed fixture expansion; no
database changes have been made as part of this assessment.

## Purpose and boundaries

The project owner intends Trinity Lutheran Church Cemetery's real DEV data to
become the first production cemetery. St. Mark Church Cemetery and Memorial
Grove Cemetery are synthetic test data. Use Trinity to identify realistic
relationships and workflows, then reproduce those patterns with fictional
people, evidence, ownership records, and media in the two demo cemeteries.

Do not duplicate Trinity's people, photos, deeds, contact information, or source
documents into demo fixtures. Keep its records and media unchanged. A future
production promotion needs a separate plan that selects Trinity and its related
records, excludes synthetic cemeteries, and configures production identities
separately; copying the entire DEV database is not that plan.

## Observed DEV coverage

Read-only queries against `cemetery_mapping_dev` and inspection of
`db/seed/demo-data.sql` produced this baseline. Counts describe active records
where the table supports soft deletion. People and markers are attributed through
their primary gravesite. Import entry counts can include repeated imports, so
they are not counts of distinct people or deeds.

| Record type | Trinity | St. Mark | Memorial Grove |
| --- | ---: | ---: | ---: |
| Sections | 7 | 2 | 1 |
| Blocks | 0 | 0 | 1 |
| Lots | 155 | 6 | 1 |
| Gravesites | 775 | 10 | 2 |
| People/burial records | 698 | 5 | 1 |
| Markers | 559 | 2 | 0 |
| Media assets | 489 | 0 | 0 |
| Grave features | 66 | 0 | 0 |
| Generalized ownership events | 27 | 0 | 0 |
| Generalized ownership rights | 60 | 0 | 0 |
| Deed registry entries | 1,836 | 0 | 0 |
| Historical transcription entries | 1,521 | 0 | 0 |
| Source-only person records | 93 | 0 | 0 |
| Historic lot-map evidence | 11 | 0 | 0 |
| Maintenance records | 1 | 0 | 0 |

The demo cemeteries have nine and two legacy `owners` rows respectively, but no
generalized ownership events or rights. Adding more legacy owner rows would not
exercise the newer ownership workflow.

Trinity includes eight pre-need inscriptions, three urn interments, 34 people
with military branches, 35 people without a populated first name, 68 maiden
names, one name prefix, nine suffixes, and 653 records with birth/death date text.
Date text does not necessarily mean a partial date. The demos have none of these
populated fields or special cases; all six demo people are casket interments.

Existing useful demo coverage should remain: repeated grave identifiers across
cemeteries, section aliases, section-scoped versus block-scoped lots, a
letter-suffixed lot, a non-burial lot, a passageway grave outside a lot, and one
couple marker linked to two distinct gravesites and two people.

## Priority 1: representative everyday and historical records

| Scenario | Proposed fictional fixture | What it should verify |
| --- | --- | --- |
| Family monument and separate graves | A four-person family group at St. Mark with four distinct gravesites and one fixed family monument; retain the existing Miller couple | Shared monuments do not create fictitious family-member burials or merge distinct graves; each person and grave remains independently editable |
| Multiple marker faces | Front, left, and back faces on the family monument, each with multiline inscriptions and selected people/photos; also retain an ordinary single-inscription marker | Face associations, gallery placement, editing, and reload preserve the intended relationships |
| Related physical markers | Two individual stones on a common base and one headstone with a foot marker | Related physical objects remain separate markers; a plaque attached to a monument is modeled as a feature when appropriate |
| Photographs | A small set of clearly synthetic, locally stored images: marker overview, face close-ups, a grave-only photo, a context photo, and a second dated photo | Marker and gravesite galleries, primary-photo selection, ordering, fallback selection, and no-photo states all have visible examples; files actually resolve |
| Incomplete names and dates | A year-only date, month/year date, unknown first name, confirmed no-given-name infant, maiden name, accented surname, prefix, and suffix | Search, display names, editing, and reports preserve uncertainty without inventing exact dates or confusing unknown names with confirmed absence |
| Pre-need and interment types | A living spouse's pre-need inscription with no death/burial date, an urn interment, and an explicitly unknown interment type | A name on a marker does not automatically mean a completed burial; statuses and dates remain consistent |
| Military service | Two fictional veterans with branch, rank, war/service, service dates, and one decoration; a military plaque and flag holder | Person-level service history remains distinct from physical memorial features; historical rank options render correctly |
| Ownership | A family lot deed covering several graves and a separate gravesite right, with structured parties and document flags | Modern ownership appears on the correct target; a single deed can cover multiple rights without duplicating parties |
| Restricted and uncertain geometry | One partially restricted lot with a restricted-area polygon, plus estimated and draft gravesite outlines with explicit provenance | Restricted areas prevent prohibited placement; estimated geometry is distinguishable from measured or reviewed data |

St. Mark should carry most historical scenarios because its section-scoped layout
resembles Trinity. Memorial Grove should become a usable contrasting cemetery,
with several occupied and reserved graves, markers, photos, and modern ownership
records inside its block-scoped hierarchy. Both need enough populated records to
exercise cemetery switching; leaving Memorial Grove almost empty weakens that
coverage.

## Priority 2: research, reconciliation, and maintenance

| Scenario | Proposed fixture and expected behavior |
| --- | --- |
| Historical transcription evidence | A small, explicitly synthetic source batch with matched, uncertain, and unlinked entries. Preserve raw transcription alongside reviewed values. Do not present invented material as an actual North Hills source. |
| Source-only people | Fictional death/church records with no known burial location, plus a reviewed link to an existing person. Unlocated source people must not manufacture graves or imply confirmed burial in the cemetery. |
| Conflicting evidence | A marker and ledger disagree about a year or surname. Store both claims and review notes; keep the unresolved case visibly unresolved. This is an additional test case, not a claim that Trinity currently has its `source_conflict` flags set. |
| Deed reconciliation | A handful of synthetic registry rows: exact lot match, old section alias, corrected lot reference, missing deed, and unresolved allocation. Verify corrections preserve original source text. |
| Historic map evidence | A passageway grave and an ambiguous historic lot reference with reviewed evidence. An uncertain source reference must not silently relocate the grave. |
| Maintenance and features | A leaning marker needing inspection, a completed cleaning, an unresolved repair, a bedstead/cradle, multiple vases, and a plaque. Some are broader workflow coverage beyond Trinity's single maintenance row. |
| Place evidence | One fictional person's recorded death place, with an explicit source, plus an unknown place. Keep death place separate from cemetery location. |

## Priority 3: deliberate workflow and authorization cases

These extend beyond the observed Trinity baseline and should be identified as
purpose-built tests: ownership transfer history and co-owner shares, unlocated
rights, open/closed deed investigations, soft deletion and recovery, rejected
cross-cemetery links, stale-edit conflicts, and permission differences between
readers, editors, and cemetery administrators.

Use dedicated test identities; do not seed real user subjects or carry DEV access
assignments into production. Cross-cemetery rejection, stale edits, and invalid
placement should be exercised by tests that attempt an operation and verify its
rejection, rather than leaving invalid baseline records in the seed.

## Existing fixture issue to resolve

Memorial Grove's `A-01-01` contains Helen Rivera as an interred person but has
gravesite status `reserved`, both in DEV and in the seed. Make this an occupied
grave for the normal baseline and retain a separate genuinely reserved grave.
If the mismatch is useful as a review exercise, create a separately labeled
scenario with an explicit expected outcome.

## Implementation and acceptance

1. Build a compact scenario catalog with stable `DEMO-` identifiers and expected
   outcomes. A useful first target is roughly 25–35 gravesites, 20–30 people,
   12–18 markers, and 12–20 synthetic images across both cemeteries, reusing
   records across related scenarios. These are planning targets, not quotas;
   coverage matters more than matching Trinity's volume.
2. Extend the reproducible seed and its media setup, not just the current DEV
   rows. Preserve existing identifiers relied on by browser tests. Explicitly
   label synthetic geometry and sources; match stated dimensions to footprints
   where a scenario depends on measurements.
3. Review seed cleanup before adding ownership, source batches, or media. The
   current seed deletes and recreates the two demo cemeteries and explicitly
   deletes only two named markers. New dependent/shared records and media files
   need scoped cleanup or repeatable updates that do not affect Trinity.
4. Validate on an isolated TEST database first. Run the seed twice and check
   stable counts, no orphaned or cross-cemetery relationships, valid spatial
   placement, media availability, and the expected current ownership results.
   Add focused database/browser checks for meaningful scenarios, including
   multi-face photos, pre-need records, and cemetery isolation.
5. Before applying to DEV, back up the database and media and check for demo edits
   worth retaining. Compare Trinity's related records and media references
   before and after, not only its row counts. Do not run automated TEST rebuild
   scripts against DEV or hosted TEST.
6. Record the seed/rebuild behavior changes in an ADR when implementing them.
   The existing demo loader's PROD refusal remains required.

This plan is based on the current DEV database and checked-in seed, not an audit
of hosted TEST or a certification that Trinity is ready for production. Its
purpose is to make the synthetic cemeteries useful for development, demonstration,
and regression testing without depending on real Trinity records.
