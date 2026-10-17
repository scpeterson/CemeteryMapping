--liquibase formatted sql

--changeset cemeterymapping:447-link-d-0505-foot-marker-to-d-0499 splitStatements:false
DO $$
DECLARE
  placeholder uuid;
  target uuid;
  marker uuid;
BEGIN
  SELECT id INTO placeholder FROM gravesites WHERE gravesite_id='TLC-GPS-0505' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT id INTO target FROM gravesites WHERE gravesite_id='TLC-GPS-0499' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(FOUND, 'active D-0499 must exist');
  SELECT id INTO marker FROM headstones WHERE headstone_id='TLC-HS-0505'
    AND gravesite_uuid=placeholder AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(FOUND, 'active TLC-HS-0505 must belong to its placeholder');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM burials WHERE gravesite_uuid=placeholder AND deleted_at IS NULL
      AND NOT (coalesce(full_name,'')='Clifford Chester Brant''s Military Plaque'
        AND trim(coalesce(first_name,''))='' AND coalesce(last_name,'')='Clifford Chester Brant''s Military Plaque')),
    'D-0505 must have no real-person burials');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM headstones WHERE gravesite_uuid=placeholder AND id<>marker AND deleted_at IS NULL),
    'D-0505 must not be the primary grave of another marker');
  PERFORM assert_migration_prerequisite(EXISTS (
    SELECT 1 FROM marker_types WHERE code='military_marker'), 'military marker type must exist');

  UPDATE headstone_burials hb SET deleted_at=now(),deleted_by=NULL,
    delete_reason='Removed military plaque label incorrectly imported as a burial.'
  FROM burials b WHERE hb.burial_uuid=b.id AND b.gravesite_uuid=placeholder
    AND b.deleted_at IS NULL AND hb.deleted_at IS NULL
    AND b.full_name='Clifford Chester Brant''s Military Plaque'
    AND trim(coalesce(b.first_name,''))='' AND b.last_name='Clifford Chester Brant''s Military Plaque';
  UPDATE burials SET deleted_at=now(),deleted_by=NULL,
    delete_reason='Removed military plaque label incorrectly imported as a burial.',updated_at=now()
    WHERE gravesite_uuid=placeholder AND deleted_at IS NULL
      AND full_name='Clifford Chester Brant''s Military Plaque'
      AND trim(coalesce(first_name,''))='' AND last_name='Clifford Chester Brant''s Military Plaque';
  UPDATE headstones SET gravesite_uuid=target,
    marker_type_id=(SELECT id FROM marker_types WHERE code='military_marker'),updated_at=now()
    WHERE id=marker;
  INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type,notes)
    VALUES(marker,target,'footstone',
      'User confirmed 2026-10-13: TLC-HS-0505 is Clifford Chester Brant''s military foot marker for D-0499, not a separate burial.')
    ON CONFLICT(headstone_uuid,gravesite_uuid) DO UPDATE SET
      relationship_type=EXCLUDED.relationship_type,notes=EXCLUDED.notes,
      deleted_at=NULL,deleted_by=NULL,delete_reason=NULL,updated_at=now();
  UPDATE headstone_gravesites SET deleted_at=now(),deleted_by=NULL,
    delete_reason='D-0505 represents the military foot marker position, not a burial gravesite.',updated_at=now()
    WHERE gravesite_uuid=placeholder AND deleted_at IS NULL;
  UPDATE gravesites SET deleted_at=now(),deleted_by=NULL,
    delete_reason='Military foot marker placeholder; TLC-HS-0505 serves D-0499.',updated_at=now()
    WHERE id=placeholder;
END $$;

--rollback empty
