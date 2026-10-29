---
permalink: /adr/supporting/passageway-review-2026-10-29/
---

# Passageway review evidence — 28–29 October 2026

These reports and maps are preserved byte-for-byte from the local review artifacts.
They are dated evidence, not a live view of DEV or hosted TEST. SHA-256 hashes
and byte lengths are recorded in [manifest.json](manifest.json).

Use [Map layout and passageways](../../../map-layout-and-passageways.md) for the
current accepted behavior through migration 504. [ADR 0178](../../0178-passageways-and-individual-deeds.md)
records passageway approval and implementation; [ADR 0179](../../0179-shift-southern-c-lots.md)
records the later southern Section C adjustment.

| Evidence | Snapshot and limitations |
| --- | --- |
| [Initial A/C proposal and full registry crosswalk](passageway-proposal.html) | 28 October, hosted TEST geometry. Preserves all 101 passage-location rows: 50 Original 2017 and 51 Updated 2022. Proposed boundaries and counts are historical. |
| [Original B/D addendum](sections-b-d-review.html) | 28 October, before temporary-lot retirement and subsequent row adjustments. Its western D extensions included E records; do not apply its candidate labels as current section assignments. |
| [Reevaluated passageways](reevaluated-passageways.html) | 29 October, after migrations 496–501 and before passageway creation 502–503 and the final C-row correction 504. Retains ten proposed IDs and identifies the D-P03 western end candidate. Its “no changes” statement describes that read-only review, not the later implementation. |
| [Proposed gravesite assignments](proposed-gravesite-assignments.html) | 56 point-based candidates prepared during the passageway implementation. No assignments applied. Some footprints cross corridor edges; migration 504 later expands C-P03, so rerun containment checks before assigning. |
| [Monuments outside areas](monuments-outside-areas.html) | Before migration 504: 56 points, including two in C, 53 in E and one in G. After 504 the two C points are covered, leaving the 54 E/G points expected under the confirmed gravesite-only policy. |

The HTML reports use the adjacent PNG maps: [initial A/C](proposed-passageways.png),
[initial B/D](proposed-b-d-passageways.png), [reevaluated A/B/C](revised-a-b-c-passageways.png)
and [reevaluated D/E](revised-d-e-passageways.png). Retain their relative paths.
No owner contact information is included in these artifacts.

## How this evidence was used

- Keep stable passageway IDs; retain historical lot-pair wording separately.
- Exclude retired temporary lots from active passageway boundaries and keep E
  records in E; being outside a lot does not establish a passageway or deed.
- Approve D-P03’s western extension around TLC-HS-0577 after the D/E correction.
- Implement typed areas in the lot layer and individual gravesite deeds in
  migrations 502–503, preserving existing grave and ownership assignments.
- Move C-41–C-51 and C-70–C-90 approximately 13.981 inches south in 504; clip
  non-burial C-85/C-90 as separately approved and extend C-P03’s southern edge.
- Sections E and G remain gravesite-only as confirmed by the owner. This is an
  operational policy; migration 502 does not add a database ban by section name.

The report rectangles, point counts, clipped operational polygons and historical
width descriptions are not surveyed boundaries, ownership proof or remaining
burial capacity. Review deeds and estimated footprints before assigning graves.
