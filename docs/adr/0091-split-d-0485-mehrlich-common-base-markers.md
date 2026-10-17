# ADR 0091: Separate Mehrlich graves and common-base monuments

Status: Accepted
Date: 2026-10-15

The owner confirmed John Mehrlich belongs in D-0485, while Margaret Mehrlich has a separate grave north of him and her own unrecorded monument on their shared base. The supplied photograph shows the two individual monuments. Preserve John's surveyed marker point and both burial records, including their existing names and dates.

Migration 450 creates D-0485A (TLC-GPS-0485-01) for Margaret and TLC-HS-0485A at an estimated point exactly three feet north of TLC-HS-0485. Transfer Margaret's burial to her grave and her marker, retire her incorrect link to John's marker, and record a common_base monument relationship. The photo's inscription spelling “Margarete” is recorded on the new marker without changing Margaret's burial name or dates. New marker condition remains unknown and placement requires review.

Use the established 4-foot north-south by 10-foot east-west operational grave size. Simply adding a northern rectangle at the original boundary overlaps D-0486. Move John's estimated polygon south so the shared boundary is at his marker latitude, and shift the polygon pair 0.3 feet west to avoid small intersections with D-0483 and D-0484. All neighboring geometries and the original marker point remain unchanged. Grave placement is estimated, not a surveyed interment limit.

Before mutation, reject unexpected burial assignments, occupied new identifiers, missing marker geometry, or neighboring grave overlaps. Environments without active D-0485 are unchanged. Back up DEV before applying and verify dimensions, grave ordering, preserved burials, unchanged original marker and neighbors, the three-foot new point offset, and separate primary links/common-base association. Recovery uses the pre-migration backup; automatic rollback is empty.
