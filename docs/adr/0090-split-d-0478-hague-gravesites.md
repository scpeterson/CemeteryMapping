# ADR 0090: Split D-0478 Hague burials into separate graves

Status: Accepted
Date: 2026-10-14

The owner confirmed Frank G Hague stays in D-0478 and Carrie Hague needs a separate grave immediately north. Both graves are 4 feet north-south by 10 feet east-west. TLC-HS-0478 stays fixed at the shared western corner, with the graves extending east. The centered layout avoids neighboring active graves and leaves approximately one foot of clearance from the southern grave to TLC-HS-0482.

Migration 448 moves Carrie's existing burial to D-0478A (TLC-GPS-0478-01), shifts Frank's original grave south, and links the shared marker to both. Burial details and marker points remain unchanged. Estimated operational polygons require field verification of actual interment limits.

Prerequisites reject unexpected burial assignments, identifier collisions, neighboring overlaps, or insufficient clearance from TLC-HS-0482. Environments without active D-0478 are unchanged. Back up DEV before applying and verify dimensions, ordering, preserved records, marker clearance, and unchanged marker geometry. Recovery uses the backup; automatic rollback is empty.
