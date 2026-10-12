--liquibase formatted sql

--changeset cemeterymapping:440-correct-d-0456-mayer-obelisk splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0456' AND deleted_at IS NULL)
  OR (
    EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0456' AND deleted_at IS NULL)
    AND (SELECT count(*) FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0457', 'TLC-GPS-0458', 'TLC-GPS-0459', 'TLC-GPS-0460', 'TLC-GPS-0461') AND deleted_at IS NULL) = 5
    AND NOT EXISTS (
      SELECT 1 FROM burials b JOIN gravesites g ON g.id = b.gravesite_uuid
      WHERE g.gravesite_id = 'TLC-GPS-0456' AND b.deleted_at IS NULL
        AND NOT (coalesce(b.full_name, '') = 'Mayer Family Obelisk'
          AND trim(coalesce(b.first_name, '')) = '' AND coalesce(b.last_name, '') = 'Mayer Family Obelisk')
    )
    AND EXISTS (SELECT 1 FROM marker_types WHERE code = 'obelisk')
    AND EXISTS (SELECT 1 FROM marker_scope_types WHERE code = 'monolith')
  ),
  'Mayer obelisk correction requires the marker, all five real gravesites, and no real burial at D-0456'
);

UPDATE headstone_burials hb
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed Mayer obelisk label incorrectly imported as a burial.'
FROM burials b, gravesites g
WHERE hb.burial_uuid = b.id AND b.gravesite_uuid = g.id
  AND g.gravesite_id = 'TLC-GPS-0456'
  AND b.full_name = 'Mayer Family Obelisk'
  AND trim(coalesce(b.first_name, '')) = '' AND b.last_name = 'Mayer Family Obelisk'
  AND hb.deleted_at IS NULL;

UPDATE burials b
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed Mayer obelisk label incorrectly imported as a burial.', updated_at = now()
FROM gravesites g
WHERE b.gravesite_uuid = g.id AND g.gravesite_id = 'TLC-GPS-0456'
  AND b.full_name = 'Mayer Family Obelisk'
  AND trim(coalesce(b.first_name, '')) = '' AND b.last_name = 'Mayer Family Obelisk'
  AND b.deleted_at IS NULL;

INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes)
SELECT h.id, g.id, 'spans',
  'User confirmed 2026-10-12: Mayer family obelisk is a monolith serving D-0457, D-0458, D-0459, D-0460, and D-0461; no burial at its D-0456 position.'
FROM headstones h CROSS JOIN gravesites g
WHERE h.headstone_id = 'TLC-HS-0456' AND h.deleted_at IS NULL
  AND g.gravesite_id IN ('TLC-GPS-0457', 'TLC-GPS-0458', 'TLC-GPS-0459', 'TLC-GPS-0460', 'TLC-GPS-0461') AND g.deleted_at IS NULL
ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
  relationship_type = EXCLUDED.relationship_type, notes = EXCLUDED.notes,
  deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now();

UPDATE headstones h
SET gravesite_uuid = g.id,
    marker_type_id = (SELECT id FROM marker_types WHERE code = 'obelisk'),
    marker_scope_type_id = (SELECT id FROM marker_scope_types WHERE code = 'monolith'),
    updated_at = now()
FROM gravesites g
WHERE h.headstone_id = 'TLC-HS-0456' AND h.deleted_at IS NULL
  AND g.gravesite_id = 'TLC-GPS-0457' AND g.deleted_at IS NULL;

UPDATE headstone_gravesites hg
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'D-0456 is the obelisk position, not a burial gravesite.', updated_at = now()
FROM headstones h, gravesites g
WHERE hg.headstone_uuid = h.id AND hg.gravesite_uuid = g.id
  AND h.headstone_id = 'TLC-HS-0456' AND g.gravesite_id = 'TLC-GPS-0456'
  AND hg.deleted_at IS NULL;

UPDATE gravesites
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'D-0456 represents the Mayer obelisk position with no burial; marker serves D-0457 through D-0461.',
    updated_at = now()
WHERE gravesite_id = 'TLC-GPS-0456' AND deleted_at IS NULL;

--rollback empty
