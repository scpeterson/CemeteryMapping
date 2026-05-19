--liquibase formatted sql

--changeset scpeterson:004-spatial-validation-severity splitStatements:false
DROP VIEW IF EXISTS spatial_validation_issues;

CREATE VIEW spatial_validation_issues AS
WITH production_section_containment AS (
  SELECT
    section.id,
    section.facility_id,
    section.section_id,
    ST_Area(ST_Difference(section.geometry, cemetery.geometry)::geography) AS outside_square_meters
  FROM sections section
  JOIN cemeteries cemetery ON cemetery.id = section.cemetery_id
  WHERE NOT ST_Covers(cemetery.geometry, section.geometry)
),
production_block_containment AS (
  SELECT
    block.id,
    block.facility_id,
    block.section_id,
    block.block_id,
    ST_Area(ST_Difference(block.geometry, section.geometry)::geography) AS outside_square_meters
  FROM blocks block
  JOIN sections section ON section.id = block.section_uuid
  WHERE NOT ST_Covers(section.geometry, block.geometry)
),
production_lot_containment AS (
  SELECT
    lot.id,
    lot.facility_id,
    lot.section_id,
    lot.block_id,
    lot.lot_id,
    ST_Area(ST_Difference(lot.geometry, block.geometry)::geography) AS outside_square_meters
  FROM lots lot
  JOIN blocks block ON block.id = lot.block_uuid
  WHERE NOT ST_Covers(block.geometry, lot.geometry)
),
production_gravesite_containment AS (
  SELECT
    grave.id,
    grave.facility_id,
    grave.section_id,
    grave.block_id,
    grave.lot_id,
    grave.grave_id,
    grave.gravesite_id,
    ST_Area(ST_Difference(grave.geometry, lot.geometry)::geography) AS outside_square_meters
  FROM gravesites grave
  JOIN lots lot ON lot.id = grave.lot_uuid
  WHERE NOT ST_Covers(lot.geometry, grave.geometry)
),
staging_section_cemetery AS (
  SELECT
    section_feature.id,
    section_feature.batch_id,
    section_feature.facility_id,
    section_feature.section_id,
    cemetery_feature.id AS cemetery_feature_id,
    CASE
      WHEN cemetery_feature.id IS NULL THEN NULL
      ELSE ST_Area(ST_Difference(section_feature.geometry, cemetery_feature.geometry)::geography)
    END AS outside_square_meters
  FROM spatial_import_features section_feature
  LEFT JOIN spatial_import_features cemetery_feature
    ON cemetery_feature.batch_id = section_feature.batch_id
   AND cemetery_feature.feature_type = 'cemetery'
   AND (cemetery_feature.facility_id IS NOT DISTINCT FROM section_feature.facility_id OR cemetery_feature.facility_id IS NULL)
  WHERE section_feature.feature_type = 'section'
)
SELECT
  'error'::text AS severity,
  'production'::text AS scope,
  NULL::uuid AS batch_id,
  'cemeteries'::text AS table_name,
  cemetery.id,
  cemetery.facility_id,
  NULL::text AS section_id,
  NULL::text AS block_id,
  NULL::text AS lot_id,
  NULL::text AS grave_id,
  NULL::text AS gravesite_id,
  'invalid_geometry'::text AS issue_code,
  ST_IsValidReason(cemetery.geometry) AS issue_detail
FROM cemeteries cemetery
WHERE NOT ST_IsValid(cemetery.geometry)

UNION ALL
SELECT
  'error',
  'production',
  NULL::uuid,
  'sections',
  section.id,
  section.facility_id,
  section.section_id,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  'invalid_geometry',
  ST_IsValidReason(section.geometry)
FROM sections section
WHERE NOT ST_IsValid(section.geometry)

UNION ALL
SELECT
  'error',
  'production',
  NULL::uuid,
  'blocks',
  block.id,
  block.facility_id,
  block.section_id,
  block.block_id,
  NULL::text,
  NULL::text,
  NULL::text,
  'invalid_geometry',
  ST_IsValidReason(block.geometry)
FROM blocks block
WHERE NOT ST_IsValid(block.geometry)

UNION ALL
SELECT
  'error',
  'production',
  NULL::uuid,
  'lots',
  lot.id,
  lot.facility_id,
  lot.section_id,
  lot.block_id,
  lot.lot_id,
  NULL::text,
  NULL::text,
  'invalid_geometry',
  ST_IsValidReason(lot.geometry)
FROM lots lot
WHERE NOT ST_IsValid(lot.geometry)

UNION ALL
SELECT
  'error',
  'production',
  NULL::uuid,
  'gravesites',
  grave.id,
  grave.facility_id,
  grave.section_id,
  grave.block_id,
  grave.lot_id,
  grave.grave_id,
  grave.gravesite_id,
  'invalid_geometry',
  ST_IsValidReason(grave.geometry)
FROM gravesites grave
WHERE NOT ST_IsValid(grave.geometry)

UNION ALL
SELECT
  'error',
  'production',
  NULL::uuid,
  'memorials',
  memorial.id,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  'invalid_geometry',
  ST_IsValidReason(memorial.geometry)
FROM memorials memorial
WHERE memorial.geometry IS NOT NULL
  AND NOT ST_IsValid(memorial.geometry)

UNION ALL
SELECT
  CASE WHEN outside_square_meters > 1 THEN 'error' ELSE 'warning' END,
  'production',
  NULL::uuid,
  'sections',
  id,
  facility_id,
  section_id,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  'outside_cemetery',
  format('Section geometry extends %s square meters outside its cemetery geometry.', round(outside_square_meters::numeric, 6))
FROM production_section_containment
WHERE outside_square_meters > 0

UNION ALL
SELECT
  CASE WHEN outside_square_meters > 1 THEN 'error' ELSE 'warning' END,
  'production',
  NULL::uuid,
  'blocks',
  id,
  facility_id,
  section_id,
  block_id,
  NULL::text,
  NULL::text,
  NULL::text,
  'outside_section',
  format('Block geometry extends %s square meters outside its section geometry.', round(outside_square_meters::numeric, 6))
FROM production_block_containment
WHERE outside_square_meters > 0

UNION ALL
SELECT
  CASE WHEN outside_square_meters > 1 THEN 'error' ELSE 'warning' END,
  'production',
  NULL::uuid,
  'lots',
  id,
  facility_id,
  section_id,
  block_id,
  lot_id,
  NULL::text,
  NULL::text,
  'outside_block',
  format('Lot geometry extends %s square meters outside its block geometry.', round(outside_square_meters::numeric, 6))
FROM production_lot_containment
WHERE outside_square_meters > 0

UNION ALL
SELECT
  CASE WHEN outside_square_meters > 1 THEN 'error' ELSE 'warning' END,
  'production',
  NULL::uuid,
  'gravesites',
  id,
  facility_id,
  section_id,
  block_id,
  lot_id,
  grave_id,
  gravesite_id,
  'outside_lot',
  format('Gravesite geometry extends %s square meters outside its lot geometry.', round(outside_square_meters::numeric, 6))
FROM production_gravesite_containment
WHERE outside_square_meters > 0

UNION ALL
SELECT
  'error',
  'production',
  NULL::uuid,
  'gravesites',
  grave_a.id,
  grave_a.facility_id,
  grave_a.section_id,
  grave_a.block_id,
  grave_a.lot_id,
  grave_a.grave_id,
  grave_a.gravesite_id,
  'overlapping_gravesite',
  format('Overlaps gravesite %s.', grave_b.gravesite_id)
FROM gravesites grave_a
JOIN gravesites grave_b
  ON grave_a.id < grave_b.id
 AND grave_a.geometry && grave_b.geometry
 AND ST_Overlaps(grave_a.geometry, grave_b.geometry)

UNION ALL
SELECT
  'error',
  'staging',
  feature.batch_id,
  'spatial_import_features',
  feature.id,
  feature.facility_id,
  feature.section_id,
  feature.block_id,
  feature.lot_id,
  feature.grave_id,
  feature.gravesite_id,
  'invalid_geometry',
  ST_IsValidReason(feature.geometry)
FROM spatial_import_features feature
WHERE NOT ST_IsValid(feature.geometry)

UNION ALL
SELECT
  'error',
  'staging',
  feature.batch_id,
  'spatial_import_features',
  feature.id,
  feature.facility_id,
  feature.section_id,
  feature.block_id,
  feature.lot_id,
  feature.grave_id,
  feature.gravesite_id,
  'polygon_expected',
  format('%s features must use Polygon or MultiPolygon geometry.', feature.feature_type)
FROM spatial_import_features feature
WHERE feature.feature_type IN ('cemetery', 'section', 'block', 'lot', 'gravesite')
  AND GeometryType(feature.geometry) NOT IN ('POLYGON', 'MULTIPOLYGON')

UNION ALL
SELECT
  'error',
  'staging',
  feature.batch_id,
  'spatial_import_features',
  feature.id,
  feature.facility_id,
  feature.section_id,
  feature.block_id,
  feature.lot_id,
  feature.grave_id,
  feature.gravesite_id,
  'point_expected',
  'Memorial features must use Point or MultiPoint geometry.'
FROM spatial_import_features feature
WHERE feature.feature_type = 'memorial'
  AND GeometryType(feature.geometry) NOT IN ('POINT', 'MULTIPOINT')

UNION ALL
SELECT
  CASE
    WHEN cemetery_feature_id IS NULL THEN 'error'
    WHEN outside_square_meters > 1 THEN 'error'
    ELSE 'warning'
  END,
  'staging',
  batch_id,
  'spatial_import_features',
  id,
  facility_id,
  section_id,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  'outside_staged_cemetery',
  CASE
    WHEN cemetery_feature_id IS NULL THEN 'Section feature has no matching cemetery feature in the same batch.'
    ELSE format('Section feature extends %s square meters outside a matching cemetery feature in the same batch.', round(outside_square_meters::numeric, 6))
  END
FROM staging_section_cemetery
WHERE cemetery_feature_id IS NULL
   OR outside_square_meters > 0

UNION ALL
SELECT
  'error',
  'staging',
  grave_a.batch_id,
  'spatial_import_features',
  grave_a.id,
  grave_a.facility_id,
  grave_a.section_id,
  grave_a.block_id,
  grave_a.lot_id,
  grave_a.grave_id,
  grave_a.gravesite_id,
  'overlapping_staged_gravesite',
  format('Overlaps staged gravesite %s.', grave_b.gravesite_id)
FROM spatial_import_features grave_a
JOIN spatial_import_features grave_b
  ON grave_a.id < grave_b.id
 AND grave_a.batch_id = grave_b.batch_id
 AND grave_a.feature_type = 'gravesite'
 AND grave_b.feature_type = 'gravesite'
 AND grave_a.geometry && grave_b.geometry
 AND ST_Overlaps(grave_a.geometry, grave_b.geometry);

--rollback DROP VIEW IF EXISTS spatial_validation_issues;
