---
---

# ADR 0070: Split B-0094 Opperman Gravesites

- Status: Accepted
- Date: 2026-09-22

## Decision

Migration 412 preserves fixed monument TLC-HS-0094 and assigns its six existing
burial records to separate Section B gravesites. The user confirmed that the
Front face naming Caroline M and Ida O faces east. The reference to A-0094
in the initial request is treated as B-0094, the existing linked gravesite.

| Gravesite | Person | Side |
| --- | --- | --- |
| B-0094 | Carl Opperman | West / Back |
| B-0094A | Ida O Opperman | East / Front |
| B-0094B | Anna A Opperman | West / Back |
| B-0094C | Caroline M Opperman | East / Front |
| B-0094D | Mary S Opperman | West / Back |
| B-0094E | William Opperman | West / Back |

New record IDs are TLC-GPS-0094-01 through -05 in suffix order. Suffixes are
operational identifiers. All six gravesites link to the monument as `spans`.
Existing face inscriptions, face-person/photo references, marker coordinates,
and burial details are preserved. Carl retains the original gravesite UUID.

## Estimated Geometry

Each polygon is 4 feet north–south by 10 feet east–west. Eastern graves extend
from the marker eastward: Caroline is immediately north of Ida. Western
graves extend westward, with Carl, Anna, Mary and William ordered north to
south. The western group extends from 6.5 feet north to 9.5 feet south of the
marker, avoiding neighboring B-0111. This within-group order is estimated;
only the east/west face grouping was confirmed. Geometry is marked estimated
and requires field verification.

## Validation and Recovery

A rolled-back DEV rehearsal verified six distinct gravesites and one burial
per gravesite, correct east/west grouping, valid 40-square-foot polygons,
no positive-area overlaps with active neighboring gravesites, six marker links,
and unchanged marker and burial records except burial gravesite assignments.
The final applied DEV state is compared with the pre-migration snapshot.

The migration guards against unexpected burial records and occupied new IDs.
It safely skips environments without the source gravesite. Rollback is empty;
recovery requires a forward correction or restoration accounting for later edits.
