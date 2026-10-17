--liquibase formatted sql

--changeset cemeterymapping:471-confirm-weitzel-burials splitStatements:false
DO $$
DECLARE
 marker headstones%ROWTYPE;
 grave gravesites%ROWTYPE;
 person record;
 burial_id uuid;
 interred uuid;
 occupied uuid;
 confirmation text := 'User confirmed interment on 2026-10-16: Jerry Lee Weitzel in D-0577; Shirley Jane Weitzel in D-0577A. Interment dates not supplied. Estimated location remains subject to field verification.';
BEGIN
 SELECT * INTO marker FROM headstones WHERE headstone_id='TLC-HS-0577' AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT id INTO STRICT interred FROM burial_record_status_types WHERE code='interred' AND is_active;
 SELECT id INTO STRICT occupied FROM gravesite_status_types WHERE code='occupied' AND is_active;
 PERFORM assert_migration_prerequisite(
  (SELECT count(*)=2 FROM gravesites WHERE facility_id='1' AND section_id='D'
   AND grave_id IN ('0577','0577A') AND deleted_at IS NULL),
  'Migration 471 requires both Weitzel gravesites');
 PERFORM assert_migration_prerequisite(NOT EXISTS(
  SELECT 1 FROM burials WHERE deleted_at IS NULL AND (last_name ILIKE 'Weitzel'
   OR gravesite_uuid IN (SELECT id FROM gravesites WHERE facility_id='1' AND section_id='D'
    AND grave_id IN ('0577','0577A') AND deleted_at IS NULL))),
  'Migration 471 requires no existing Weitzel or assigned burial records; reconcile instead of duplicating');

 FOR person IN SELECT * FROM (VALUES
  ('0577','TLC-GPS-0577','Jerry Lee','Jerry Lee Weitzel'),
  ('0577A','TLC-GPS-0577-01','Shirley Jane','Shirley Jane Weitzel'))
  p(grave_id,public_id,given_name,full_name)
 LOOP
  SELECT * INTO STRICT grave FROM gravesites WHERE facility_id='1' AND section_id='D'
   AND grave_id=person.grave_id AND gravesite_id=person.public_id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(grave.name=person.full_name AND EXISTS(
   SELECT 1 FROM headstone_gravesites WHERE headstone_uuid=marker.id AND gravesite_uuid=grave.id),
   'Migration 471 requires the expected named graves and shared monument links');
  INSERT INTO burials(gravesite_uuid,gravesite_id,first_name,last_name,full_name,
    burial_record_status_type_id,interment_type_id,notes,source_properties)
  VALUES(grave.id,grave.gravesite_id,person.given_name,'Weitzel',person.full_name,
    interred,(SELECT id FROM burial_interment_types WHERE code='unknown'),confirmation,jsonb_build_object('IntermentConfirmation',
     jsonb_build_object('source','User confirmation','confirmedOn','2026-10-16','grave','D-'||person.grave_id)))
  RETURNING id INTO burial_id;
  INSERT INTO headstone_burials(headstone_uuid,burial_uuid) VALUES(marker.id,burial_id);
  UPDATE gravesites SET status_type_id=occupied,updated_at=now(),
    geometry_notes=concat_ws(' ',geometry_notes,confirmation) WHERE id=grave.id;
 END LOOP;
 UPDATE headstones SET source_properties=jsonb_set(COALESCE(source_properties,'{}'::jsonb),
    '{GravesiteAssignments}',COALESCE(source_properties->'GravesiteAssignments','{}'::jsonb)||
     jsonb_build_object('intermentConfirmed',true,'confirmedOn','2026-10-16')),
   review_notes=concat_ws(' ',review_notes,confirmation),updated_at=now()
 WHERE id=marker.id;
END $$;

-- Recovery uses the pre-migration backup; preserve the confirmed interments.
--rollback empty
