# ADR 0087: Split the D-0453 Brandt burials into separate graves

Status: Accepted
Date: 2026-10-09

The owner confirmed that Philip Brandt remains in D-0453 and Regina and Elizabeth Brandt require separate graves north of it. The imported Regina/Elizabeth burial combines two people and assigns Regina's years to both.

Migration 437 preserves the original grave and surveyed TLC-HS-0453 point. Create D-0453A for Regina immediately north, then D-0453B for Elizabeth farther north, each 4 feet north–south by 10 feet east–west. Placement is estimated, not a field-confirmed interment location. Reject identifier collisions and overlapping active graves rather than moving neighbors.

Retain the combined burial ID for Regina, preserve its original contents as provenance, and create a separate Elizabeth burial. Use dates explicitly present on the marker's front and right inscriptions. Keep the monument-wide record, faces, photos, Philip record, and existing associations intact; add links from the shared marker to both new graves and Elizabeth.

Rebuild with `npm run db:migrate` for the selected environment. Back up DEV before applying; verify geometry dimensions, ordering, non-overlap, three separate burial assignments, and unchanged marker/original grave. The correction has no automatic destructive rollback; restore the pre-release backup if necessary. Environments without TLC-GPS-0453 are unchanged.
