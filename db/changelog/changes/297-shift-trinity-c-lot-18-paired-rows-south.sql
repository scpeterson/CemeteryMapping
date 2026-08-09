--liquibase formatted sql

--changeset cemeterymapping:297-shift-trinity-c-lot-18-paired-rows-south splitStatements:false
WITH target_lots AS (
  SELECT id, geometry
  FROM lots
  WHERE deleted_at IS NULL
    AND upper(COALESCE(section_id, '')) = 'C'
    AND block_id IS NULL
    AND lot_id IN (
      '100', '99', '98', '97', '96', '39', '19', '18', '17', '16', '15', '14', '13', '12', '11', '10',
      '95', '94', '93', '92', '91', '40', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29'
    )
),
group_center AS (
  SELECT ST_Centroid(ST_Collect(geometry)) AS center_point
  FROM target_lots
),
translation AS (
  SELECT
    ST_Y(ST_Project(center_point::geography, 1.5 * 0.0254, radians(180))::geometry) - ST_Y(center_point) AS latitude_delta
  FROM group_center
)
UPDATE lots
SET
  geometry = ST_Translate(target_lots.geometry, 0, translation.latitude_delta)::geometry(MultiPolygon, 4326),
  geometry_source = 'Shifted 1.5 inches south as the paired Section C rows containing lots C-18 and C-21.',
  geometry_notes = concat_ws(
    ' ',
    NULLIF(lots.geometry_notes, ''),
    'Both aligned rows were shifted 1.5 inches south on 2026-08-09 so fixed marker TLC-HS-0312 falls inside lot C-18.'
  ),
  updated_at = now()
FROM target_lots, translation
WHERE lots.id = target_lots.id;

--rollback WITH target_lots AS (SELECT id, geometry FROM lots WHERE deleted_at IS NULL AND upper(COALESCE(section_id, '')) = 'C' AND block_id IS NULL AND lot_id IN ('100', '99', '98', '97', '96', '39', '19', '18', '17', '16', '15', '14', '13', '12', '11', '10', '95', '94', '93', '92', '91', '40', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29')), group_center AS (SELECT ST_Centroid(ST_Collect(geometry)) AS center_point FROM target_lots), translation AS (SELECT ST_Y(ST_Project(center_point::geography, 1.5 * 0.0254, radians(0))::geometry) - ST_Y(center_point) AS latitude_delta FROM group_center) UPDATE lots SET geometry = ST_Translate(target_lots.geometry, 0, translation.latitude_delta)::geometry(MultiPolygon, 4326), updated_at = now() FROM target_lots, translation WHERE lots.id = target_lots.id;
