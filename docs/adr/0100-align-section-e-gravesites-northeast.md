# ADR 0100: Align Section E graves northeast from fixed monuments

Status: Accepted
Date: 2026-10-16

The owner requested rotating gravesites displayed with E- identifiers 45 degrees north from east-west, with monuments centered on the southwestern edge rather than within the grave polygon. Interpret this as a long-axis true bearing of 45 degrees (northeast), with the fixed monument at the midpoint of the southwestern short edge. Preserve all monument points, burial/ownership records, associations, and graves outside Section E.

Migration 461 targets active Section E gravesites in Trinity (facility 1). Each must have one active mapped direct monument and a valid four-corner rectangle. Measure the original geodesic long/short edges independently of polygon vertex order, then reconstruct the rectangle northeast from its monument using those lengths. This avoids latitude/longitude rotation distortion and handles both centered and edge-anchored originals. Preserve mapped sizes and the existing dimension metadata: imported footprints often measure about 8 by 4 feet despite stored 10-by-4-foot metadata. This request is an alignment correction, not a resize.

The preview covers 54 gravesites. Internal overlapping pairs decline from 42 to 30; one overlap with another section remains. Flag residual conflicts in affected Section E geometry notes rather than shifting surveyed monuments or changing adjacent records. Geometry remains operational/estimated. Back up DEV and verify true bearing, southwest-edge midpoint, original physical dimensions/area, unchanged record associations and other geometries, and expected update count. Clean installations without imported Section E graves are unchanged. Recovery uses the backup; automatic rollback is empty.
