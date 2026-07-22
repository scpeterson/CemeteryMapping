--liquibase formatted sql

--changeset cemeterymapping:237-normalize-c-0160-survey-provenance splitStatements:false
WITH marker AS (
  UPDATE headstones
  SET
    source_properties = COALESCE(source_properties, '{}'::jsonb) || jsonb_build_object(
      'NormalizedProvenance',
      jsonb_build_object(
        'cemeterySection', 'C',
        'nhgInclusion', 'not_listed',
        'markerGeometrySourceType', 'field_survey',
        'markerGeometrySource', 'TrinityCemeteryFinal3.shp',
        'burialIdentitySource', 'headstone spreadsheet row 160',
        'verificationStatus', 'verified',
        'verifiedAt', '2026-07-22'
      )
    ),
    data_confidence = 'high',
    review_status = 'reviewed',
    review_notes = concat_ws(
      ' ',
      NULLIF(review_notes, ''),
      'Marker location and identity verified against the surveyed shapefile record. This marker is physically in cemetery Section C but is not listed in the North Hills Genealogists book.'
    ),
    source_conflict = false,
    reviewed_by = 'migration 237 normalized survey provenance',
    reviewed_at = now(),
    updated_at = now()
  WHERE headstone_id = 'TLC-HS-0160'
    AND deleted_at IS NULL
  RETURNING id
),
marker_burials AS (
  SELECT burials.id
  FROM burials
  JOIN headstone_burials
    ON headstone_burials.burial_uuid = burials.id
   AND headstone_burials.deleted_at IS NULL
  JOIN marker
    ON marker.id = headstone_burials.headstone_uuid
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) IN (
      'clair r "bill" wiskeman',
      'martha j wiskeman'
    )
)
UPDATE burials
SET
  notes = regexp_replace(
    COALESCE(burials.notes, ''),
    'North Hills Genealogists section: C[.] North Hills Genealogists row: 0[.] Trinity Lutheran Church section: NA[.]',
    'Not listed in the North Hills Genealogists book. Burial and marker identity verified against surveyed marker TLC-HS-0160.'
  ),
  data_confidence = 'high',
  review_status = 'reviewed',
  review_notes = concat_ws(
    ' ',
    NULLIF(burials.review_notes, ''),
    'Burial identity verified against surveyed marker TLC-HS-0160; no NHG entry exists for this marker.'
  ),
  source_conflict = false,
  reviewed_by = 'migration 237 normalized survey provenance',
  reviewed_at = now(),
  updated_at = now()
FROM marker_burials
WHERE burials.id = marker_burials.id;

--rollback empty
