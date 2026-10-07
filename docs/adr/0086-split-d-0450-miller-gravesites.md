# 0086: Split D-0450 Miller gravesites

Date: 2026-10-07

Peter Miller and Christina Miller share headstone TLC-HS-0450 and were both assigned to D-0450. The user requested separate 4-by-10-foot gravesites, Christina north of Peter, with the unchanged headstone between them.

Peter remains in D-0450 (TLC-GPS-0450), whose polygon moves south. Christina moves to D-0450A (TLC-GPS-0450-01). The headstone is the shared western corner: each grave extends ten feet east, Peter four feet south, and Christina four feet north. Both burial-to-marker links remain, and the marker links to both gravesites. Boundaries remain estimated operational geometry.

Migration 435 verifies the existing records, the marker geometry, the two burial associations, and availability of the new identifier before making changes. Databases without the source grave skip the correction. No automatic rollback is provided for this data correction.

A transactional preview against DEV found approximately 18.26 square feet of overlap between the proposed Peter polygon and the estimated D-0449 (Heinrich P Miller) polygon. Christina's proposed polygon does not overlap neighboring graves. The correction does not move D-0449 or suppress spatial validation findings; field review is needed to establish the actual neighboring burial limits.
