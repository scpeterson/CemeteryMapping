--liquibase formatted sql

--changeset cemeterymapping:505-store-monument-orientation-bearing splitStatements:false
-- Store the reviewed long-axis bearing in the existing structured source metadata.
-- Section E was explicitly aligned northeast at true bearing 45 degrees by migration 461.
UPDATE headstones
SET source_properties = COALESCE(source_properties, '{}'::jsonb)
  || jsonb_build_object(
    'MonumentOrientation',
    COALESCE(source_properties->'MonumentOrientation', '{}'::jsonb)
      || jsonb_build_object('bearingDegrees', 45, 'source', 'Migration 461 Section E alignment')
  ),
  updated_at = now()
WHERE deleted_at IS NULL
  AND id IN (
    SELECT DISTINCT h.id
    FROM headstones h
    JOIN headstone_gravesites hg ON hg.headstone_uuid = h.id AND hg.deleted_at IS NULL
    JOIN gravesites g ON g.id = hg.gravesite_uuid AND g.deleted_at IS NULL
    JOIN sections s ON s.name = g.section_id AND s.cemetery_id = g.cemetery_id AND s.deleted_at IS NULL
    JOIN cemeteries c ON c.id = g.cemetery_id AND c.deleted_at IS NULL
    WHERE c.name = 'Trinity Lutheran Church Cemetery'
      AND upper(s.name) = 'E'
      AND hg.relationship_type = 'primary'
  );

--rollback UPDATE headstones SET source_properties = source_properties - 'MonumentOrientation', updated_at = now() WHERE source_properties ? 'MonumentOrientation';
