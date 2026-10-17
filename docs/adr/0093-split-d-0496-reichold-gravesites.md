# ADR 0093: Split D-0496 Reichold burials into separate graves

Status: Accepted
Date: 2026-10-15

The owner confirmed only Karl Reichold belongs in D-0496. Elizabeth Reichold needs a separate grave immediately north, and both share TLC-HS-0496, whose surveyed point must remain unchanged.

Migration 452 creates D-0496A (TLC-GPS-0496-01) for Elizabeth, transfers her existing burial without changing her identity or details, and links the shared monument to both graves. Karl retains the original gravesite and burial identifiers. His estimated operational polygon shifts south to put the fixed monument at the shared western corner of the two graves. Each grave extends 10 feet east and measures 4 feet north-south, matching the existing operational dimensions. Neighboring graves are unchanged. These estimated polygons do not establish surveyed interment limits.

Prerequisites reject unexpected burial assignments, missing monument geometry or burial links, occupied new identifiers, and neighboring grave overlaps. Environments without active D-0496 are unchanged. Transaction-isolated database tests verify preserved monument and burial links, separate burial assignments, dimensions, north-south ordering, and fail-before-change guards.

Back up DEV before applying. Verify the shared monument point and both existing burial records, active links to both graves, no neighboring polygon changes, and no overlapping active graves. Recovery uses the pre-migration backup; automatic rollback is empty.
