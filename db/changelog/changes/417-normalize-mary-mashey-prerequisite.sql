--liquibase formatted sql

--changeset cemeterymapping:417-normalize-mary-mashey-prerequisite splitStatements:false
-- Intentionally included BEFORE 415. Do not edit 415's already-applied checksum.
-- TEST retained the original imported surname; DEV had already separated it.
DO $repair$
DECLARE
  source_grave uuid;
  source_marker uuid;
  mary burials%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM databasechangelog
    WHERE id = '415-split-b-0103-mashey-gravesites' AND author = 'cemeterymapping'
      AND filename = 'changes/415-split-b-0103-mashey-gravesites.sql') THEN
    RETURN; -- Already-split environments retain all subsequent edits.
  END IF;

  IF NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0103' AND deleted_at IS NULL) THEN
    RETURN; -- No imported Trinity source in this environment.
  END IF;

  PERFORM assert_migration_prerequisite(
    (SELECT count(*) FROM gravesites WHERE gravesite_id = 'TLC-GPS-0103' AND deleted_at IS NULL) = 1,
    'exactly one active Mashey source gravesite must exist');
  SELECT id INTO source_grave FROM gravesites WHERE gravesite_id = 'TLC-GPS-0103' AND deleted_at IS NULL;

  PERFORM assert_migration_prerequisite(
    (SELECT count(*) FROM headstones WHERE headstone_id = 'TLC-HS-0103'
      AND gravesite_uuid = source_grave AND deleted_at IS NULL) = 1,
    'exactly one active Mashey marker must belong to the source gravesite');
  SELECT id INTO source_marker FROM headstones WHERE headstone_id = 'TLC-HS-0103'
    AND gravesite_uuid = source_grave AND deleted_at IS NULL;

  PERFORM assert_migration_prerequisite(
    (SELECT count(*) FROM burials WHERE gravesite_uuid = source_grave AND deleted_at IS NULL) = 2
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE hb.headstone_uuid = source_marker AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
        AND b.gravesite_uuid = source_grave AND b.first_name = 'Amos' AND b.last_name = 'Mashey') = 1
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE hb.headstone_uuid = source_marker AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
        AND b.gravesite_uuid = source_grave AND b.first_name = 'Mary'
        AND ((b.last_name = 'Mashey/Gollmar' AND COALESCE(b.maiden_name, '') = '')
          OR (b.last_name = 'Mashey' AND b.maiden_name = 'Gollmar'))) = 1,
    'the source grave and marker must have exactly the expected Amos and Mary Mashey burials; conflicting maiden names require review');

  SELECT b.* INTO STRICT mary FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
    WHERE hb.headstone_uuid = source_marker AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
      AND b.gravesite_uuid = source_grave AND b.first_name = 'Mary';
  IF mary.last_name = 'Mashey' THEN RETURN; END IF;

  PERFORM assert_migration_prerequisite(mary.full_name = 'Mary Mashey/Gollmar',
    'Mary must retain the original imported full name before normalization');
  PERFORM set_config('app.audit.source', 'migration', true);
  PERFORM set_config('app.audit.reason', 'Migration 417: separate Mary Mashey surname and Gollmar maiden name, matching approved DEV, before migration 415.', true);
  UPDATE burials SET last_name = 'Mashey', maiden_name = 'Gollmar', full_name = 'Mary Mashey', updated_at = now()
    WHERE id = mary.id;
END
$repair$;

--rollback empty
