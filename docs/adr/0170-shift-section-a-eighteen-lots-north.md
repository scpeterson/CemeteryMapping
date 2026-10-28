# ADR 0170: Move eighteen Section A lots north as one group

- Date: 2026-10-28
- Status: Accepted

## Decision

The owner requested a shared northward adjustment of A-1 through A-9 and A-30
through A-38 so TLC-HS-0053 lies fully inside A-34. Migration 495 translates
exactly those 18 active Trinity lots one foot (0.3048 metres) north. Compute one
latitude offset at the group's centroid using a PostGIS geography projection and
apply that same offset to every vertex. Longitudes, footprints, dimensions,
numbering, shared edges and relative positions are preserved.

TLC-HS-0053 is stored as an observed point. On the reviewed DEV geometry it is
about 4.7 inches beyond A-34's original northern edge; the translation puts it
strictly inside A-34 with approximately 7.3 inches of boundary clearance. The
marker and gravesite geometries, associations, burial facts, ownership and photo
records retain their existing values. Geometry remains estimated operational
placement; this correction does not establish a surveyed physical marker outline.

Require all 18 distinct lot labels with valid nonempty geometry in one cemetery,
the active marker linked to that cemetery, strict marker containment after the
shift, no neighboring-lot overlaps above 0.001 square metres, and cemetery-boundary
coverage. Databases without Trinity Section A skip the correction. Incomplete or
incompatible Trinity layouts stop before any update. Preserve existing geometry
notes and record the migration source and reason through database auditing.

The imported Section A outline already cuts across this grid (seven selected
lots extend beyond it before the correction). Its approximate outline remains
unchanged by this lot-only adjustment. All shifted lots remain inside the actual
cemetery boundary. A section-outline correction requires separate field review.

## Validation and recovery

Run rollback-only TEST fixtures for the group translation, fixed marker/graves,
strict containment, 25 shared edges, dimensions and unrelated records. Exercise
missing lots/marker, a marker in another cemetery, incompatible marker placement,
neighbor overlap, cemetery-boundary crossing, empty footprints and absent data.
Rehearse the exact migration in a rolled-back DEV transaction and compare full
row hashes for unrelated lots, graves, markers, burials, ownership and photo links.

DEV also retained migration 485 checksum `9:60043b74ad3258d56775dc20560d1e9b`.
Liquibase 4.33.0 independently reproduces it from committed revision `c2f2ad9`;
its forward SQL is unchanged. Accept that exact historical checksum alongside
the existing original checksum, without clearing migration history.

Before applying to DEV, retain a validated private database dump and exact EWKB
snapshots of the selected lots. Apply through Liquibase, then repeat containment,
translation and preservation checks. Hosted TEST and other environments receive
the correction through a separately authorized, rehearsed migration deployment.
Automatic SQL rollback is empty, matching prior owner-directed lot corrections;
recovery uses the pre-migration backup or a reviewed forward correction.

## Update triggers

Add a new decision if membership, displacement, dimensions, marker position or
neighboring layout changes. Do not rewrite this accepted migration after use.
