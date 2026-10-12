--liquibase formatted sql

--changeset cemeterymapping:439-correct-d-0454-soergel-obelisk splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0454' AND deleted_at IS NULL)
  OR (
    EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0454' AND deleted_at IS NULL)
    AND (SELECT count(*) FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0455', 'TLC-GPS-0501') AND deleted_at IS NULL) = 2
    AND NOT EXISTS (
      SELECT 1 FROM burials b JOIN gravesites g ON g.id = b.gravesite_uuid
      WHERE g.gravesite_id = 'TLC-GPS-0454' AND b.deleted_at IS NULL
        AND NOT (b.full_name = 'Check Records Soergel Obelisk'
          AND b.first_name = 'Check Records' AND b.last_name = 'Soergel Obelisk')
    )
    AND EXISTS (SELECT 1 FROM marker_types WHERE code = 'obelisk')
  ),
  'Soergel obelisk correction requires the marker, both real gravesites, and no real burial at D-0454'
);

UPDATE headstone_burials hb
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed Soergel obelisk label incorrectly imported as a burial.'
FROM burials b, gravesites g
WHERE hb.burial_uuid = b.id AND b.gravesite_uuid = g.id
  AND g.gravesite_id = 'TLC-GPS-0454'
  AND b.full_name = 'Check Records Soergel Obelisk'
  AND b.first_name = 'Check Records' AND b.last_name = 'Soergel Obelisk'
  AND hb.deleted_at IS NULL;

UPDATE burials b
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed Soergel obelisk label incorrectly imported as a burial.', updated_at = now()
FROM gravesites g
WHERE b.gravesite_uuid = g.id AND g.gravesite_id = 'TLC-GPS-0454'
  AND b.full_name = 'Check Records Soergel Obelisk'
  AND b.first_name = 'Check Records' AND b.last_name = 'Soergel Obelisk'
  AND b.deleted_at IS NULL;

INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes)
SELECT h.id, g.id, 'spans',
  'User confirmed 2026-10-12: Soergel obelisk serves D-0455 (Johann Conrad Soergel) and D-0501 (Walburga Soergel); no burial at its D-0454 position.'
FROM headstones h CROSS JOIN gravesites g
WHERE h.headstone_id = 'TLC-HS-0454' AND h.deleted_at IS NULL
  AND g.gravesite_id IN ('TLC-GPS-0455', 'TLC-GPS-0501') AND g.deleted_at IS NULL
ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
  relationship_type = EXCLUDED.relationship_type, notes = EXCLUDED.notes,
  deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now();

UPDATE headstones h
SET gravesite_uuid = g.id,
    marker_type_id = (SELECT id FROM marker_types WHERE code = 'obelisk'),
    updated_at = now()
FROM gravesites g
WHERE h.headstone_id = 'TLC-HS-0454' AND h.deleted_at IS NULL
  AND g.gravesite_id = 'TLC-GPS-0455' AND g.deleted_at IS NULL;

UPDATE headstone_gravesites hg
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'D-0454 is the obelisk position, not a burial gravesite.', updated_at = now()
FROM headstones h, gravesites g
WHERE hg.headstone_uuid = h.id AND hg.gravesite_uuid = g.id
  AND h.headstone_id = 'TLC-HS-0454' AND g.gravesite_id = 'TLC-GPS-0454'
  AND hg.deleted_at IS NULL;

UPDATE gravesites
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'D-0454 represents the Soergel obelisk position with no burial; marker serves D-0455 and D-0501.',
    updated_at = now()
WHERE gravesite_id = 'TLC-GPS-0454' AND deleted_at IS NULL;

--rollback empty
