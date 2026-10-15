# ADR 0094: Split D-0497 Schmeltz burials into separate graves

Status: Accepted
Date: 2026-10-15

The owner confirmed only Georg H Schmeltz belongs in D-0497. Elizabeth Schmeltz needs a separate grave immediately north, and both share TLC-HS-0497, whose surveyed point must remain unchanged.

The original gravesite display name incorrectly identifies Elizabeth; update it to Georg H Schmeltz.

Migration 453 creates D-0497A (TLC-GPS-0497-01) for Elizabeth, transfers her existing burial without changing her identity or details, and links the shared monument to both graves. Georg H retains the original gravesite and burial identifiers. His estimated operational polygon shifts south to put the fixed monument at the shared western corner of the two graves. Each grave extends 10 feet east and measures 4 feet north-south, matching the existing operational dimensions. Neighboring graves are unchanged. These estimated polygons do not establish surveyed interment limits.

Prerequisites reject unexpected burial assignments, missing monument geometry or burial links, occupied new identifiers, and neighboring grave overlaps. Environments without active D-0497 are unchanged. Transaction-isolated database tests verify preserved monument and burial links, separate burial assignments, dimensions, north-south ordering, and fail-before-change guards.

Back up DEV before applying. Verify the shared monument point and both existing burial records, active links to both graves, no neighboring polygon changes, and no overlapping active graves. Recovery uses the pre-migration backup; automatic rollback is empty.
