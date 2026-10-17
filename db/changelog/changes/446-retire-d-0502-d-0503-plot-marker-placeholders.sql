--liquibase formatted sql

--changeset cemeterymapping:446-retire-d-0502-d-0503-plot-marker-placeholders splitStatements:false
DO $$
DECLARE
  suffix text;
  grave_uuid uuid;
  marker_uuid uuid;
BEGIN
  FOREACH suffix IN ARRAY ARRAY['0502','0503'] LOOP
    SELECT id INTO grave_uuid FROM gravesites
      WHERE gravesite_id = 'TLC-GPS-' || suffix AND deleted_at IS NULL;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT id INTO marker_uuid FROM headstones
      WHERE headstone_id = 'TLC-HS-' || suffix AND gravesite_uuid = grave_uuid AND deleted_at IS NULL;
    PERFORM assert_migration_prerequisite(FOUND,
      'active TLC-HS-' || suffix || ' must belong to its plot-marker placeholder');
    PERFORM assert_migration_prerequisite(NOT EXISTS (
      SELECT 1 FROM burials WHERE gravesite_uuid = grave_uuid AND deleted_at IS NULL
        AND NOT (coalesce(full_name, '') = 'Plot Marker, PB'
          AND trim(coalesce(first_name, '')) = '' AND coalesce(last_name, '') = 'Plot Marker, PB')),
      'D-' || suffix || ' must contain no real-person burials');
    PERFORM assert_migration_prerequisite(NOT EXISTS (
      SELECT 1 FROM headstones WHERE gravesite_uuid = grave_uuid
        AND id <> marker_uuid AND deleted_at IS NULL),
      'D-' || suffix || ' must not be the primary grave of another active marker');

    UPDATE headstone_burials hb SET deleted_at = now(), deleted_by = NULL,
      delete_reason = 'Removed Plot Marker, PB label incorrectly imported as a burial.'
    FROM burials b WHERE hb.burial_uuid = b.id AND b.gravesite_uuid = grave_uuid
      AND b.deleted_at IS NULL AND hb.deleted_at IS NULL
      AND b.full_name = 'Plot Marker, PB' AND trim(coalesce(b.first_name, '')) = ''
      AND b.last_name = 'Plot Marker, PB';
    UPDATE burials SET deleted_at = now(), deleted_by = NULL,
      delete_reason = 'Removed Plot Marker, PB label incorrectly imported as a burial.', updated_at = now()
      WHERE gravesite_uuid = grave_uuid AND deleted_at IS NULL
        AND full_name = 'Plot Marker, PB' AND trim(coalesce(first_name, '')) = ''
        AND last_name = 'Plot Marker, PB';
    UPDATE headstones SET gravesite_uuid = NULL, updated_at = now() WHERE id = marker_uuid;
    UPDATE headstone_gravesites SET deleted_at = now(), deleted_by = NULL,
      delete_reason = 'Removed link to plot-marker placeholder D-' || suffix || '.', updated_at = now()
      WHERE gravesite_uuid = grave_uuid AND deleted_at IS NULL;
    UPDATE gravesites SET deleted_at = now(), deleted_by = NULL,
      delete_reason = 'Plot-marker position with no burial; preserve standalone TLC-HS-' || suffix || '.',
      updated_at = now() WHERE id = grave_uuid;
  END LOOP;
END $$;

--rollback empty
