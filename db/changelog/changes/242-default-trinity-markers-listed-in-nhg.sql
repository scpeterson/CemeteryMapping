--liquibase formatted sql

--changeset cemeterymapping:242-default-trinity-markers-listed-in-nhg splitStatements:false
WITH trinity AS (
  SELECT id
  FROM cemeteries
  WHERE facility_id = '1'
     OR name = 'Trinity Lutheran Church Cemetery'
  ORDER BY (facility_id = '1') DESC, name
  LIMIT 1
),
trinity_markers AS (
  SELECT DISTINCT headstones.id
  FROM headstones
  JOIN gravesites
    ON gravesites.id = headstones.gravesite_uuid
   AND gravesites.deleted_at IS NULL
  JOIN trinity
    ON trinity.id = gravesites.cemetery_id
  WHERE headstones.deleted_at IS NULL

  UNION

  SELECT DISTINCT headstones.id
  FROM headstones
  JOIN headstone_gravesites
    ON headstone_gravesites.headstone_uuid = headstones.id
   AND headstone_gravesites.deleted_at IS NULL
  JOIN gravesites
    ON gravesites.id = headstone_gravesites.gravesite_uuid
   AND gravesites.deleted_at IS NULL
  JOIN trinity
    ON trinity.id = gravesites.cemetery_id
  WHERE headstones.deleted_at IS NULL
)
UPDATE headstones
SET
  source_properties = COALESCE(source_properties, '{}'::jsonb) || jsonb_build_object(
    'NormalizedProvenance',
    COALESCE(source_properties->'NormalizedProvenance', '{}'::jsonb)
      || jsonb_build_object('nhgInclusion', 'listed')
  ),
  updated_at = now()
FROM trinity_markers
WHERE headstones.id = trinity_markers.id
  AND NOT jsonb_exists(
    COALESCE(headstones.source_properties, '{}'::jsonb)
      -> 'NormalizedProvenance',
    'nhgInclusion'
  );

--rollback empty
