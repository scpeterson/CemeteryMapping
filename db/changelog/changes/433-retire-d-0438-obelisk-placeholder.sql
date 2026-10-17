--liquibase formatted sql

--changeset cemeterymapping:433-retire-d-0438-obelisk-placeholder splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0438' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM gravesites g JOIN headstones h ON h.gravesite_uuid = g.id
    WHERE g.gravesite_id = 'TLC-GPS-0438' AND g.deleted_at IS NULL
      AND h.headstone_id = 'TLC-HS-0438' AND h.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM burials WHERE gravesite_uuid = g.id AND deleted_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM grave_features WHERE gravesite_uuid = g.id)
      AND NOT EXISTS (SELECT 1 FROM maintenance_records WHERE gravesite_uuid = g.id)
      AND NOT EXISTS (SELECT 1 FROM ownership_event_rights WHERE gravesite_uuid = g.id)
      AND NOT EXISTS (SELECT 1 FROM owners WHERE gravesite_uuid = g.id)
      AND NOT EXISTS (SELECT 1 FROM source_person_record_links WHERE gravesite_uuid = g.id)
      AND NOT EXISTS (SELECT 1 FROM historic_lot_map_gravesite_evidence WHERE gravesite_uuid = g.id)
      AND NOT EXISTS (SELECT 1 FROM north_hills_ocr_entry_gravesite_links WHERE gravesite_uuid = g.id AND status <> 'rejected')
      AND NOT EXISTS (
        SELECT 1 FROM gravesite_media_assets gm WHERE gm.gravesite_uuid = g.id AND gm.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM headstone_media_assets hm WHERE hm.headstone_uuid = h.id
            AND hm.media_asset_id = gm.media_asset_id AND hm.deleted_at IS NULL AND hm.status = 'linked')
      )
      AND NOT EXISTS (SELECT 1 FROM headstones other WHERE other.gravesite_uuid = g.id
        AND other.deleted_at IS NULL AND other.id <> h.id)
      AND NOT EXISTS (SELECT 1 FROM headstone_gravesites other WHERE other.gravesite_uuid = g.id
        AND other.deleted_at IS NULL AND other.headstone_uuid <> h.id)
  ),
  'D-0438 must have no real burials or operational dependencies and all photos must remain linked to its obelisk'
);

UPDATE headstone_gravesites hg
SET deleted_at = now(), deleted_by = NULL,
  delete_reason = 'D-0438 is a non-burial placeholder for standalone obelisk TLC-HS-0438.', updated_at = now()
FROM gravesites g, headstones h
WHERE hg.gravesite_uuid = g.id AND hg.headstone_uuid = h.id
  AND g.gravesite_id = 'TLC-GPS-0438' AND h.headstone_id = 'TLC-HS-0438'
  AND g.deleted_at IS NULL AND h.deleted_at IS NULL AND hg.deleted_at IS NULL;

UPDATE headstones h SET gravesite_uuid = NULL, updated_at = now()
FROM gravesites g
WHERE h.gravesite_uuid = g.id AND g.gravesite_id = 'TLC-GPS-0438'
  AND h.headstone_id = 'TLC-HS-0438' AND h.deleted_at IS NULL AND g.deleted_at IS NULL;

UPDATE gravesites SET deleted_at = now(), deleted_by = NULL,
  delete_reason = 'User confirmed D-0438 is only a placeholder for standalone Mayer family obelisk TLC-HS-0438; no one is buried here.',
  updated_at = now()
WHERE gravesite_id = 'TLC-GPS-0438' AND deleted_at IS NULL;

--rollback empty
