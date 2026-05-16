--liquibase formatted sql

--changeset scpeterson:003-spatial-import-staging splitStatements:false
CREATE TABLE spatial_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_format text,
  source_srid integer,
  imported_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE spatial_import_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES spatial_import_batches(id) ON DELETE CASCADE,
  feature_type text NOT NULL,
  source_feature_id text,
  facility_id text,
  section_id text,
  block_id text,
  lot_id text,
  grave_id text,
  gravesite_id text,
  source_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  geometry geometry(Geometry, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spatial_import_features_type_check
    CHECK (feature_type IN ('cemetery', 'section', 'block', 'lot', 'gravesite', 'memorial')),
  CONSTRAINT spatial_import_features_geometry_check
    CHECK (
      GeometryType(geometry) IN (
        'POINT',
        'MULTIPOINT',
        'POLYGON',
        'MULTIPOLYGON'
      )
    )
);

CREATE INDEX spatial_import_features_batch_idx ON spatial_import_features (batch_id);
CREATE INDEX spatial_import_features_type_idx ON spatial_import_features (feature_type);
CREATE INDEX spatial_import_features_hierarchy_idx ON spatial_import_features (facility_id, section_id, block_id, lot_id, grave_id, gravesite_id);
CREATE INDEX spatial_import_features_geometry_gix ON spatial_import_features USING gist (geometry);

CREATE VIEW spatial_validation_issues AS
SELECT
  'production'::text AS scope,
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
  'production',
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
  'production',
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
  'production',
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
  'production',
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
  'production',
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
  'production',
  'sections',
  section.id,
  section.facility_id,
  section.section_id,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  'outside_cemetery',
  'Section geometry is not covered by its cemetery geometry.'
FROM sections section
JOIN cemeteries cemetery ON cemetery.id = section.cemetery_id
WHERE NOT ST_Covers(cemetery.geometry, section.geometry)

UNION ALL
SELECT
  'production',
  'blocks',
  block.id,
  block.facility_id,
  block.section_id,
  block.block_id,
  NULL::text,
  NULL::text,
  NULL::text,
  'outside_section',
  'Block geometry is not covered by its section geometry.'
FROM blocks block
JOIN sections section ON section.id = block.section_uuid
WHERE NOT ST_Covers(section.geometry, block.geometry)

UNION ALL
SELECT
  'production',
  'lots',
  lot.id,
  lot.facility_id,
  lot.section_id,
  lot.block_id,
  lot.lot_id,
  NULL::text,
  NULL::text,
  'outside_block',
  'Lot geometry is not covered by its block geometry.'
FROM lots lot
JOIN blocks block ON block.id = lot.block_uuid
WHERE NOT ST_Covers(block.geometry, lot.geometry)

UNION ALL
SELECT
  'production',
  'gravesites',
  grave.id,
  grave.facility_id,
  grave.section_id,
  grave.block_id,
  grave.lot_id,
  grave.grave_id,
  grave.gravesite_id,
  'outside_lot',
  'Gravesite geometry is not covered by its lot geometry.'
FROM gravesites grave
JOIN lots lot ON lot.id = grave.lot_uuid
WHERE NOT ST_Covers(lot.geometry, grave.geometry)

UNION ALL
SELECT
  'production',
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
  'staging',
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
  'staging',
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
  'staging',
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
  'staging',
  'spatial_import_features',
  section_feature.id,
  section_feature.facility_id,
  section_feature.section_id,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  'outside_staged_cemetery',
  'Section feature is not covered by a cemetery feature in the same batch.'
FROM spatial_import_features section_feature
LEFT JOIN spatial_import_features cemetery_feature
  ON cemetery_feature.batch_id = section_feature.batch_id
 AND cemetery_feature.feature_type = 'cemetery'
 AND (cemetery_feature.facility_id IS NOT DISTINCT FROM section_feature.facility_id OR cemetery_feature.facility_id IS NULL)
 AND ST_Covers(cemetery_feature.geometry, section_feature.geometry)
WHERE section_feature.feature_type = 'section'
  AND cemetery_feature.id IS NULL

UNION ALL
SELECT
  'staging',
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
--rollback DROP TABLE IF EXISTS spatial_import_features;
--rollback DROP TABLE IF EXISTS spatial_import_batches;
