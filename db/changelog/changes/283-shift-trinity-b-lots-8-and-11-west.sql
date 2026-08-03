--liquibase formatted sql

--changeset cemeterymapping:283-shift-trinity-b-lots-8-and-11-west splitStatements:false
WITH target_lots AS (
  SELECT
    lots.id,
    lots.geometry,
    ST_Centroid(lots.geometry) AS center_point
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND lots.facility_id = '1'
    AND upper(COALESCE(lots.section_id, '')) = 'B'
    AND lots.lot_id IN ('8', '11')
    AND lots.block_id IS NULL
),
translations AS (
  SELECT
    id,
    geometry,
    ST_X(
      ST_Project(center_point::geography, 0.3048, radians(270))::geometry
    ) - ST_X(center_point) AS longitude_delta
  FROM target_lots
)
UPDATE lots
SET
  geometry = ST_Translate(translations.geometry, translations.longitude_delta, 0)::geometry(MultiPolygon, 4326),
  geometry_source = 'Shifted one foot west by reviewed placement request.',
  geometry_notes = 'Reviewed Section B lot shifted one foot west while preserving its footprint and alignment.',
  updated_at = now()
FROM translations
WHERE lots.id = translations.id;

--rollback UPDATE lots SET geometry = ST_Translate(lots.geometry, ST_X(ST_Project(ST_Centroid(lots.geometry)::geography, 0.3048, radians(90))::geometry) - ST_X(ST_Centroid(lots.geometry)), 0)::geometry(MultiPolygon, 4326), geometry_source = CASE WHEN lots.lot_id = '8' THEN 'Created from the C-42A footprint and reviewed Section B placement constraints.' ELSE 'Created as an exact westward copy of B-8 with a shared lot boundary.' END, geometry_notes = CASE WHEN lots.lot_id = '8' THEN 'Reviewed Section B lot reconstructed from surveyed reference features.' ELSE 'Reviewed Section B lot reconstructed from the B-8 footprint.' END, updated_at = now() WHERE lots.facility_id = '1' AND lots.section_id = 'B' AND lots.lot_id IN ('8', '11') AND lots.block_id IS NULL AND lots.deleted_at IS NULL;
