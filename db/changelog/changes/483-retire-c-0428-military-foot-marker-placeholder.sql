--liquibase formatted sql

--changeset cemeterymapping:483-retire-c-0428-military-foot-marker-placeholder splitStatements:false
DO $$
DECLARE
  placeholder gravesites%ROWTYPE;
  target gravesites%ROWTYPE;
  foot_marker headstones%ROWTYPE;
  main_marker headstones%ROWTYPE;
  david uuid;
  reason text := 'User confirmed 2026-10-21: TLC-HS-0428 is David L Vandevort''s military foot marker in C-0427; C-0428 is not a burial gravesite.';
BEGIN
  SELECT * INTO placeholder FROM gravesites WHERE gravesite_id='TLC-GPS-0428' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO target FROM gravesites WHERE gravesite_id='TLC-GPS-0427' AND deleted_at IS NULL;
  SELECT * INTO foot_marker FROM headstones WHERE headstone_id='TLC-HS-0428' AND deleted_at IS NULL;
  SELECT * INTO main_marker FROM headstones WHERE headstone_id='TLC-HS-0427' AND deleted_at IS NULL;
  SELECT id INTO david FROM burials WHERE gravesite_uuid=target.id AND deleted_at IS NULL
    AND lower(full_name)='david lynn vandevort';
  PERFORM assert_migration_prerequisite(
    target.id IS NOT NULL AND target.section_id='C' AND placeholder.section_id='C'
    AND placeholder.cemetery_id=target.cemetery_id
    AND foot_marker.id IS NOT NULL AND foot_marker.gravesite_uuid=target.id
    AND main_marker.id IS NOT NULL AND main_marker.gravesite_uuid=target.id
    AND david IS NOT NULL
    AND foot_marker.marker_type_id=(SELECT id FROM marker_types WHERE code='military_marker')
    AND EXISTS(SELECT 1 FROM headstone_burials WHERE headstone_uuid=foot_marker.id AND burial_uuid=david AND deleted_at IS NULL)
    AND EXISTS(SELECT 1 FROM headstone_gravesites WHERE headstone_uuid=foot_marker.id AND gravesite_uuid=target.id AND relationship_type='footstone' AND deleted_at IS NULL),
    'C-0428 retirement requires the existing military foot marker and canonical David Lynn Vandevort burial in C-0427'
  );
  PERFORM assert_migration_prerequisite(
    NOT EXISTS(SELECT 1 FROM burials WHERE gravesite_uuid=placeholder.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM headstones WHERE gravesite_uuid=placeholder.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM headstone_gravesites WHERE gravesite_uuid=placeholder.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM gravesite_media_assets WHERE gravesite_uuid=placeholder.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM grave_features WHERE gravesite_uuid=placeholder.id)
    AND NOT EXISTS(SELECT 1 FROM maintenance_records WHERE gravesite_uuid=placeholder.id)
    AND NOT EXISTS(SELECT 1 FROM ownership_event_rights WHERE gravesite_uuid=placeholder.id)
    AND NOT EXISTS(SELECT 1 FROM owners WHERE gravesite_uuid=placeholder.id)
    AND NOT EXISTS(SELECT 1 FROM source_person_record_links WHERE gravesite_uuid=placeholder.id)
    AND NOT EXISTS(SELECT 1 FROM historic_lot_map_gravesite_evidence WHERE gravesite_uuid=placeholder.id)
    AND NOT EXISTS(SELECT 1 FROM north_hills_ocr_entry_gravesite_links WHERE gravesite_uuid=placeholder.id AND status <> 'rejected'),
    'C-0428 must have no active burials, marker or photo links, or operational/evidence dependencies'
  );

  INSERT INTO headstone_relationships (
    from_headstone_uuid,to_headstone_uuid,relationship_type,source_type,source_text,confidence,notes,status
  ) VALUES (foot_marker.id,main_marker.id,'foot_marker','manual',reason,'high',reason,'active')
  ON CONFLICT (from_headstone_uuid,to_headstone_uuid,relationship_type) WHERE deleted_at IS NULL
  DO UPDATE SET source_type=EXCLUDED.source_type,source_text=EXCLUDED.source_text,
    confidence=EXCLUDED.confidence,notes=EXCLUDED.notes,status='active',updated_at=now();

  UPDATE headstone_gravesites SET notes=concat_ws(' ',NULLIF(notes,''),reason),updated_at=now()
    WHERE headstone_uuid=foot_marker.id AND gravesite_uuid=target.id AND deleted_at IS NULL;
  UPDATE gravesites SET deleted_at=now(),deleted_by=NULL,delete_reason=reason,updated_at=now()
    WHERE id=placeholder.id;
END $$;

-- Historical placeholder and duplicate burial rows are retained. Recovery requires a reviewed forward correction.
--rollback empty
