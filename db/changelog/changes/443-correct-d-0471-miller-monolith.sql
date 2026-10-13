--liquibase formatted sql

--changeset cemeterymapping:443-correct-d-0471-miller-monolith splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0471' AND deleted_at IS NULL)
  OR (
    EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0471' AND deleted_at IS NULL)
    AND (SELECT count(*) FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0470', 'TLC-GPS-0472') AND deleted_at IS NULL) = 2
    AND NOT EXISTS (
      SELECT 1 FROM burials b JOIN gravesites g ON g.id = b.gravesite_uuid
      WHERE g.gravesite_id = 'TLC-GPS-0471' AND b.deleted_at IS NULL
        AND NOT (coalesce(b.full_name, '') = 'John and Catherine Miller''s Joint Stone'
          AND trim(coalesce(b.first_name, '')) = '' AND coalesce(b.last_name, '') = 'John and Catherine Miller''s Joint Stone')
    )
    AND EXISTS (SELECT 1 FROM marker_scope_types WHERE code = 'monolith')
  ),
  'Miller family monolith correction requires the marker, both real gravesites, and no real burial at D-0471'
);

UPDATE headstone_burials hb
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed Miller family monolith label incorrectly imported as a burial.'
FROM burials b, gravesites g
WHERE hb.burial_uuid = b.id AND b.gravesite_uuid = g.id
  AND g.gravesite_id = 'TLC-GPS-0471'
  AND b.full_name = 'John and Catherine Miller''s Joint Stone'
  AND trim(coalesce(b.first_name, '')) = '' AND b.last_name = 'John and Catherine Miller''s Joint Stone'
  AND hb.deleted_at IS NULL;

UPDATE burials b
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed Miller family monolith label incorrectly imported as a burial.', updated_at = now()
FROM gravesites g
WHERE b.gravesite_uuid = g.id AND g.gravesite_id = 'TLC-GPS-0471'
  AND b.full_name = 'John and Catherine Miller''s Joint Stone'
  AND trim(coalesce(b.first_name, '')) = '' AND b.last_name = 'John and Catherine Miller''s Joint Stone'
  AND b.deleted_at IS NULL;

INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes)
SELECT h.id, g.id, 'spans',
  'User confirmed 2026-10-13: Miller family monolith serves D-0470 (John Miller) and D-0472 (Catherine Miller); no burial at its D-0471 position.'
FROM headstones h CROSS JOIN gravesites g
WHERE h.headstone_id = 'TLC-HS-0471' AND h.deleted_at IS NULL
  AND g.gravesite_id IN ('TLC-GPS-0470', 'TLC-GPS-0472') AND g.deleted_at IS NULL
ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
  relationship_type = EXCLUDED.relationship_type, notes = EXCLUDED.notes,
  deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now();

UPDATE headstones h
SET gravesite_uuid = g.id,
    marker_scope_type_id = (SELECT id FROM marker_scope_types WHERE code = 'monolith'),
    updated_at = now()
FROM gravesites g
WHERE h.headstone_id = 'TLC-HS-0471' AND h.deleted_at IS NULL
  AND g.gravesite_id = 'TLC-GPS-0470' AND g.deleted_at IS NULL;

UPDATE headstone_gravesites hg
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'D-0471 is the family monolith position, not a burial gravesite.', updated_at = now()
FROM headstones h, gravesites g
WHERE hg.headstone_uuid = h.id AND hg.gravesite_uuid = g.id
  AND h.headstone_id = 'TLC-HS-0471' AND g.gravesite_id = 'TLC-GPS-0471'
  AND hg.deleted_at IS NULL;

UPDATE gravesites
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'D-0471 represents the Miller family monolith position with no burial; marker serves D-0470 and D-0472.',
    updated_at = now()
WHERE gravesite_id = 'TLC-GPS-0471' AND deleted_at IS NULL;

--rollback empty
