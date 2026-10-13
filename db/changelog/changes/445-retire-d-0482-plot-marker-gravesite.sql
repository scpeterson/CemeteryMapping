--liquibase formatted sql

--changeset cemeterymapping:445-retire-d-0482-plot-marker-gravesite splitStatements:false
DO $$
DECLARE
  grave_uuid uuid;
  marker_uuid uuid;
BEGIN
  SELECT id INTO grave_uuid FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0482' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT id INTO marker_uuid FROM headstones
    WHERE headstone_id = 'TLC-HS-0482' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(FOUND,
    'active plot marker TLC-HS-0482 must remain');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM burials WHERE gravesite_uuid = grave_uuid AND deleted_at IS NULL),
    'D-0482 must have no active burials before retiring the plot-marker placeholder');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM headstones WHERE gravesite_uuid = grave_uuid
      AND id <> marker_uuid AND deleted_at IS NULL),
    'D-0482 must not be the primary grave of another active marker');

  UPDATE headstones SET gravesite_uuid = NULL, updated_at = now()
    WHERE id = marker_uuid AND gravesite_uuid = grave_uuid;
  UPDATE headstone_gravesites SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'D-0482 represents a plot marker position, not a burial gravesite.', updated_at = now()
    WHERE gravesite_uuid = grave_uuid AND deleted_at IS NULL;
  UPDATE gravesites SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'D-0482 is a plot-marker placeholder with no burial; preserve standalone TLC-HS-0482.',
    updated_at = now() WHERE id = grave_uuid;
END $$;

--rollback empty
