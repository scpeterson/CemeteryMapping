--liquibase formatted sql

--changeset cemeterymapping:477-retire-c-0165-foundation-stone-placeholder splitStatements:false
DO $$
DECLARE
  grave gravesites%ROWTYPE;
  marker headstones%ROWTYPE;
  placeholder_ids uuid[];
  reason text := 'C-0165 Foundation Stone is an imported non-burial placeholder; no one is buried here. Preserve standalone TLC-HS-0165 and its observed map location.';
BEGIN
  SELECT * INTO grave FROM gravesites WHERE gravesite_id='TLC-GPS-0165' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO marker FROM headstones WHERE headstone_id='TLC-HS-0165' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(
    grave.section_id='C' AND lower(btrim(grave.name))='foundation stone'
    AND marker.id IS NOT NULL AND marker.gravesite_uuid=grave.id AND marker.geometry IS NOT NULL
    AND EXISTS(SELECT 1 FROM headstone_gravesites WHERE headstone_uuid=marker.id AND gravesite_uuid=grave.id AND deleted_at IS NULL),
    'Migration 477 requires the C-0165 Foundation Stone placeholder and its active marker');
  PERFORM assert_migration_prerequisite(
    NOT EXISTS(SELECT 1 FROM burials b WHERE b.gravesite_uuid=grave.id AND b.deleted_at IS NULL AND NOT (
      lower(btrim(b.full_name)) IS NOT DISTINCT FROM 'foundation stone'
      AND lower(btrim(b.last_name)) IS NOT DISTINCT FROM 'foundation stone'
      AND NULLIF(btrim(b.first_name),'') IS NULL AND b.birth_date IS NULL AND b.death_date IS NULL AND b.burial_date IS NULL
      AND NULLIF(btrim(b.birth_date_text),'') IS NULL AND NULLIF(btrim(b.death_date_text),'') IS NULL))
    AND NOT EXISTS(SELECT 1 FROM headstones WHERE gravesite_uuid=grave.id AND id<>marker.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM headstone_gravesites WHERE deleted_at IS NULL AND
      ((gravesite_uuid=grave.id AND headstone_uuid<>marker.id) OR (headstone_uuid=marker.id AND gravesite_uuid<>grave.id)))
    AND NOT EXISTS(SELECT 1 FROM headstone_burials hb JOIN burials b ON b.id=hb.burial_uuid WHERE hb.deleted_at IS NULL AND
      ((hb.headstone_uuid=marker.id AND b.deleted_at IS NULL AND b.gravesite_uuid IS DISTINCT FROM grave.id)
      OR (b.gravesite_uuid=grave.id AND hb.headstone_uuid<>marker.id)))
    AND NOT EXISTS(SELECT 1 FROM gravesite_media_assets WHERE gravesite_uuid=grave.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM ownership_event_rights WHERE gravesite_uuid=grave.id AND deleted_at IS NULL),
    'C-0165 must have no real burial, conflicting marker links, gravesite media or ownership rights');
  SELECT COALESCE(array_agg(id),ARRAY[]::uuid[]) INTO placeholder_ids FROM burials WHERE gravesite_uuid=grave.id AND deleted_at IS NULL;
  UPDATE headstone_burials hb SET deleted_at=now(),deleted_by=NULL,delete_reason=reason
    FROM burials b WHERE hb.burial_uuid=b.id AND b.gravesite_uuid=grave.id AND hb.deleted_at IS NULL;
  UPDATE burials SET deleted_at=now(),deleted_by=NULL,delete_reason=reason,updated_at=now()
    WHERE gravesite_uuid=grave.id AND deleted_at IS NULL;
  UPDATE headstone_gravesites SET deleted_at=now(),deleted_by=NULL,delete_reason=reason,updated_at=now()
    WHERE gravesite_uuid=grave.id AND deleted_at IS NULL;
  UPDATE headstones SET gravesite_uuid=NULL,
    faces=COALESCE((SELECT jsonb_agg(face||jsonb_build_object('burialIds',COALESCE((
      SELECT jsonb_agg(burial_id) FROM jsonb_array_elements_text(COALESCE(face->'burialIds','[]'::jsonb)) burial_id
      WHERE NOT (burial_id=ANY(placeholder_ids::text[]))), '[]'::jsonb)))
      FROM jsonb_array_elements(COALESCE(faces,'[]'::jsonb)) face),'[]'::jsonb),
    faces_revision=faces_revision+1,updated_at=now()
    WHERE id=marker.id;
  UPDATE gravesites SET deleted_at=now(),deleted_by=NULL,delete_reason=reason,updated_at=now() WHERE id=grave.id;
END $$;

-- Historical rows are retained; recovery requires a backup or reviewed forward correction.
--rollback empty
