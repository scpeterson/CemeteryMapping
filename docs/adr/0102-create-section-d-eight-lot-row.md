# 0102: Add the eight-lot Section D row

## Decision
Duplicate the corrected D-38 footprint into eight adjoining lots. The six western positions align above the prior six-lot row, with two more positions extending east. Place the southern edge six feet north of the preceding row's northern edge, measured geodesically due north.

East to west, use D-28, D-29, D-37, D-48, D-57, D-TEMP-01, D-TEMP-02, and D-TEMP-03. Temporary names have internal codes TMP01–TMP03 to fit the existing five-character lot identifier field. They are explicitly not official numbers.

## Consequences
All eight lots retain the reference shape and 16.36 by 16 foot dimensions, with estimated locations. The three western temporary lots have non_burial status, using existing restrictions against gravesites and markers. No existing map records, burial records, or assignments change. Destination-number and overlap guards prevent overwriting existing lots. Recovery uses the pre-migration database backup.

## Location revision
Migration 465 translates all eight new lots one foot west using a single longitude offset measured at D-37's centroid. Latitudes, shared boundaries, lot dimensions, temporary names, and non-burial restrictions remain unchanged. The preceding six-lot row remains fixed.
