--liquibase formatted sql

--changeset cemeterymapping:472-correct-weitzel-pre-need-notes splitStatements:false
DO $$
DECLARE
 jerry burials%ROWTYPE;
 shirley burials%ROWTYPE;
 marker headstones%ROWTYPE;
 old_sentence text := 'User confirmed interment on 2026-10-16: Jerry Lee Weitzel in D-0577; Shirley Jane Weitzel in D-0577A.';
 corrected text := 'Jerry Lee Weitzel has a pre-need inscription for D-0577; his interment is not confirmed. Shirley Jane Weitzel is interred in D-0577A.';
BEGIN
 SELECT * INTO marker FROM headstones WHERE headstone_id='TLC-HS-0577' AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT b.* INTO STRICT jerry FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid
 WHERE g.facility_id='1' AND g.section_id='D' AND g.grave_id='0577'
 AND b.full_name='Jerry Lee Weitzel' AND b.deleted_at IS NULL AND g.deleted_at IS NULL;
 SELECT b.* INTO STRICT shirley FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid
 WHERE g.facility_id='1' AND g.section_id='D' AND g.grave_id='0577A'
 AND b.full_name='Shirley Jane Weitzel' AND b.deleted_at IS NULL AND g.deleted_at IS NULL;
 PERFORM assert_migration_prerequisite(
  EXISTS(SELECT 1 FROM headstone_burials WHERE headstone_uuid=marker.id AND burial_uuid=jerry.id AND deleted_at IS NULL)
  AND EXISTS(SELECT 1 FROM headstone_burials WHERE headstone_uuid=marker.id AND burial_uuid=shirley.id AND deleted_at IS NULL),
  'Migration 472 requires the expected shared Weitzel monument links');
 UPDATE burials SET notes=replace(notes,old_sentence,corrected),updated_at=now()
 WHERE id IN (jerry.id,shirley.id) AND notes LIKE '%'||old_sentence||'%';
 UPDATE burials SET
  burial_record_status_type_id=(SELECT id FROM burial_record_status_types WHERE code='pre_need_inscription' AND is_active),
  source_properties=(COALESCE(source_properties,'{}'::jsonb)-'IntermentConfirmation')||
   jsonb_build_object('IntermentStatus',jsonb_build_object('status','pre_need_inscription',
    'intermentConfirmed',false,'source','User correction','correctedOn','2026-10-16')),
  updated_at=now()
 WHERE id=jerry.id;
 UPDATE gravesites SET geometry_notes=replace(geometry_notes,old_sentence,corrected),updated_at=now()
 WHERE id IN (jerry.gravesite_uuid,shirley.gravesite_uuid) AND geometry_notes LIKE '%'||old_sentence||'%';
 UPDATE headstones SET review_notes=replace(review_notes,old_sentence,corrected),
  source_properties=jsonb_set(COALESCE(source_properties,'{}'::jsonb),'{GravesiteAssignments}',
    (COALESCE(source_properties->'GravesiteAssignments','{}'::jsonb)-'confirmedOn')||
    jsonb_build_object('intermentConfirmed',false,'intermentStatusByGrave',
      jsonb_build_object('D-0577','pre_need_inscription','D-0577A','interred'))),
  updated_at=now()
 WHERE id=marker.id;
END $$;

-- Recovery uses the pre-migration backup; retain the corrected pre-need status.
--rollback empty
