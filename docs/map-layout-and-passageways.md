---
---

# Map Layout and Passageways

This guide describes the accepted map and ownership behavior through migration
504, merged in [PR #744](https://github.com/scpeterson/CemeteryMapping/pull/744).
It is an operational map, not a survey. Migration application and deployment are
separate: verify each environment’s changelog and release before assuming it has
the same layout as DEV. The reviewed changes were applied to DEV; this review
does not establish that hosted TEST has received them.

## Lots, passageways, and gravesite-only sections

Lots and passageways share the `lots` table, map source, selection controls,
search, detail panel and UUID-based gravesite assignment. `area_type` distinguishes
`lot` from `passageway`. The map labels the selection mode **Lots & passageways**;
passageways use amber outlines and fill. Restriction flags are separate from the
area type: a non-burial lot is not a passageway.

| Behavior | Lot | Passageway |
| --- | --- | --- |
| Stable ID, polygon and assigned gravesites | Yes | Yes; section plus P01/P02/P03 |
| Individual gravesite deeds, including multiple listed gravesites on one deed | Yes | Yes |
| Whole-area ownership | Allowed, subject to direct-rights conflict checks | Blocked by API and database |
| Ordinary five-active-gravesite limit | Enforced | Exempt; corridor capacity still requires review |
| Original registry location evidence | Supported in `location_references` | 101 source references preserved across A/C passages |

One person may own every individual gravesite in a passageway without owning
the corridor. Ownership follows the selected gravesite rights; merely drawing
or assigning a polygon does not establish a deed or permission to inter a burial.

**Trinity Sections E and G are gravesite-only:** the owner confirms that they
will have neither lots nor passageways. Their monuments being outside those
polygons is expected. This is operating policy, not a section-name database
constraint. B passageways have no confirmed burial-use evidence in this review;
historical utility concerns remain relevant.

## Accepted passageway inventory

| ID | Location and interpretation |
| --- | --- |
| A-P01 | Between A-30–A-38 and A-52–A-60; use corrected active lot edges. |
| B-P01 | Northern gap, B-24/B-18/B-1 to B-23/B-19/B-17/B-2. |
| B-P02 | Middle gap, B-22/B-20/B-16/B-3 to B-21/B-15/B-4. |
| B-P03 | Southern gap, B-14/B-5 to B-13/B-6. |
| C-P01 | Northern corridor, including C-106–C-110/C-111–C-115 and the larger eastern lots. |
| C-P02 | Middle corridor between the central opposing rows; preserve ambiguous registry references separately. |
| C-P03 | Southern corridor, above C-41–C-51/C-86–C-90; its southern edge expands with the 32-lot shift in migration 504. |
| D-P01 | Between D-53/D-5/D-33/D-TMP14/D-TMP13 and D-54/D-51/D-34/D-32/D-25, clipped to D. |
| D-P02 | Between D-55/D-50/D-35/D-31/D-26 and D-56/D-49/D-36/D-30/D-27. TLC-GPS-0453-02 is an estimated candidate, not an automatic assignment. |
| D-P03 | Between D-TMP02/D-78/D-57/D-48/D-37/D-29/D-28 and D-77/D-68/D-67/D-58/D-47/D-38, including the approved western extension to D/E around TLC-HS-0577. |

Migration 503 clips each corridor to its section and excludes preexisting active
lots. Final polygons can differ from the shaded rectangular review bands.
Migration 504 then extends C-P03 south without moving its northern edge.

## Assign a gravesite and record its deed

1. Select the gravesite and open **Location and geometry**.
2. Choose the section-specific passageway in **Assigned lot or passageway** and
   select **Save lot assignment**. The selector sends the area UUID so repeated
   P01/P02/P03 IDs cannot select a different section accidentally.
3. Open **People and ownership**, then **Record deed or transfer**.
4. Choose **This gravesite** or **Listed gravesites**, enter the owners, original
   effective date and document reference, and save. **This whole lot** is disabled
   for a passageway and rejected by the API/database if submitted directly.

Assignment changes the explicit relationship and section/block hierarchy; it
moves neither marker nor grave geometry and does not rewrite existing rights.
Spatial suggestions remain review evidence. No existing gravesites were
assigned automatically by migrations 503 or 504. Review the
[56-candidate assignment snapshot](adr/supporting/passageway-review-2026-10-29/proposed-gravesite-assignments.html)
and rerun current containment checks before linking records.

## Registry traceability

Keep the modern passageway ID separate from the original workbook, worksheet,
cell, wording and interpretation note. `location_references` is location evidence,
not an owner list or a rights ledger. The source register and archived crosswalk
preserve 50 Original 2017 rows and 51 Updated 2022 rows.

- Preserve 2017 G207 `79-102` alongside the 2022 F216/H216 correction to `97-102`.
- Keep `30-73` unresolved and separate from `39-73`; do not silently merge them.
- Preserve missing or changed A suffixes and the single-lot `Passage 98` wording.
- Retain transfer history without treating repeated source rows as additional land.
- No B/D-specific registry passage allocations were confirmed by this crosswalk.

## Recent reviewed geometry corrections

| Migration | Accepted result |
| --- | --- |
| 495 | Move A-1–A-9 and A-30–A-38 north together to contain fixed TLC-HS-0053 in A-34. |
| 496 | Retire thirteen defunct D temporary lots; preserve history. |
| 497 | Align the northern D row east; clip D-33 and non-burial D-TMP13/D-TMP14. |
| 498 | Rename D-TMP01 to standard D-78 and shift the approved twelve-lot group west around fixed TLC-HS-0496; D-TMP02 stays non-burial and D-TMP03 stays retired. |
| 499 | Shift the ten-lot D-25 group west around fixed TLC-HS-0447. |
| 500 | Shift D-77/D-67/D-68/D-58/D-47/D-38 west around fixed TLC-HS-0500 in D-77 and TLC-HS-0463 in D-38. |
| 501 | Deflect only the shared D/E corner north: TLC-HS-0577 in D, TLC-HS-0554 in E; preserve all other vertices and the combined footprint. |
| 502–503 | Add the typed-area model, ownership guards, ten approved passageways and original references without changing existing assignments. |
| 504 | Move C-41–C-51 and C-70–C-90 approximately 13.981 inches south; contain TLC-HS-0330 in C-80 and TLC-HS-0361 in C-82; clip non-burial C-85/C-90 and expand C-P03. |

These corrections keep markers fixed. Ordinary translated lots preserve shapes
and dimension metadata; explicitly clipped lots change their polygon footprints.
After 504, the reviewed Trinity monument-point coverage check found no uncovered
points in A–D. The remaining 53 E points and one G point are expected under the
gravesite-only policy. This is a dated point check, not physical-footprint coverage
or proof of the linked grave’s assignment.

## Decisions and evidence

- [ADR 0175: Map loading performance](adr/0175-map-ownership-query.md)
- [ADR 0178: Passageway areas and individual deeds](adr/0178-passageways-and-individual-deeds.md)
- [ADR 0179: Southern C rows and C-P03 expansion](adr/0179-shift-southern-c-lots.md)
- [Archived reports, maps, status notes and hashes](adr/supporting/passageway-review-2026-10-29/README.md)
- [Reevaluated passageways report](adr/supporting/passageway-review-2026-10-29/reevaluated-passageways.html)

The archived reevaluation precedes migrations 502–504. Preserve it as decision
evidence; use this guide, the later ADRs and current database geometry for the
implemented state. Hosted deployment must be verified independently.
