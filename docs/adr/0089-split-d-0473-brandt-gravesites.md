# ADR 0089: Split D-0473 Brandt burials into separate graves

Status: Accepted
Date: 2026-10-13

The owner confirmed Johann Heinrich Brandt belongs in D-0473 and Katharine Brandt needs a separate grave north of it, with both graves 4 by 10 feet and TLC-HS-0473 remaining fixed. The existing records already represent two people separately.

Migration 442 retains Johann Heinrich's original grave ID and moves Katharine's existing burial to D-0473A (TLC-GPS-0473-01). It links the unchanged marker to both graves and preserves both burial IDs, names, dates, and marker-burial links.

Use rectangles 4 feet north-south by 10 feet east-west extending east from the marker line. An exactly marker-centered pair overlaps estimated D-0463 by about 7.88 square feet. The minimum northward adjustment at 0.01-foot resolution is 0.81 feet; use 0.85 feet for slight clearance. This places the shared western corner 0.85 feet north of the fixed marker, as near to the boundary between the graves as neighboring geometry allows. Placement is estimated, not a field-confirmed interment survey.

Reject identifier collisions, unexpected burial assignments, missing marker geometry, or overlap with another active grave before mutation. Environments without active D-0473 are unchanged. Back up DEV before applying; verify dimensions, northern ordering, burial assignments, non-overlap, and unchanged marker point. Automatic rollback is empty; restore the backup if recovery is necessary.
