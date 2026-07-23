--liquibase formatted sql

--changeset cemeterymapping:244-default-standalone-trinity-markers-listed-in-nhg splitStatements:false
WITH trinity AS (
  SELECT id, geometry
  FROM cemeteries
  WHERE facility_id = '1'
     OR name = 'Trinity Lutheran Church Cemetery'
  ORDER BY (facility_id = '1') DESC, name
  LIMIT 1
)
UPDATE headstones
SET
  source_properties = COALESCE(source_properties, '{}'::jsonb) || jsonb_build_object(
    'NormalizedProvenance',
    COALESCE(source_properties->'NormalizedProvenance', '{}'::jsonb)
      || jsonb_build_object('nhgInclusion', 'listed')
  ),
  updated_at = now()
FROM trinity
WHERE headstones.deleted_at IS NULL
  AND headstones.geometry IS NOT NULL
  AND ST_Covers(trinity.geometry, headstones.geometry)
  AND NOT jsonb_exists(
    COALESCE(headstones.source_properties->'NormalizedProvenance', '{}'::jsonb),
    'nhgInclusion'
  );

--rollback empty
