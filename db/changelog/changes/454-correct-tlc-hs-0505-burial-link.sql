--liquibase formatted sql

--changeset cemeterymapping:454-correct-tlc-hs-0505-burial-link splitStatements:false
DO $$
DECLARE
  marker headstones%ROWTYPE;
  clifford_id uuid;
  jacoueline_id uuid;
BEGIN
  SELECT * INTO marker FROM headstones
    WHERE headstone_id='TLC-HS-0505' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(EXISTS (
    SELECT 1 FROM gravesites WHERE id=marker.gravesite_uuid
      AND gravesite_id='TLC-GPS-0499' AND deleted_at IS NULL),
    'TLC-HS-0505 must belong to active D-0499');
  PERFORM assert_migration_prerequisite(
    (SELECT count(*) FROM burials WHERE gravesite_uuid=marker.gravesite_uuid
      AND full_name='Clifford Chester Brant' AND deleted_at IS NULL)=1
    AND (SELECT count(*) FROM burials WHERE gravesite_uuid=marker.gravesite_uuid
      AND full_name='Jacoueline Lois Brant' AND deleted_at IS NULL)=1,
    'exactly one active Clifford Chester Brant and Jacoueline Lois Brant must exist in D-0499');
  SELECT id INTO clifford_id FROM burials WHERE gravesite_uuid=marker.gravesite_uuid
    AND full_name='Clifford Chester Brant' AND deleted_at IS NULL;
  SELECT id INTO jacoueline_id FROM burials WHERE gravesite_uuid=marker.gravesite_uuid
    AND full_name='Jacoueline Lois Brant' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM headstone_burials WHERE headstone_uuid=marker.id AND deleted_at IS NULL
      AND burial_uuid NOT IN (clifford_id,jacoueline_id)),
    'TLC-HS-0505 must have no unexpected active burial links');

  -- Explicit association prevents fallback to every person in the linked grave.
  INSERT INTO headstone_burials(headstone_uuid,burial_uuid)
    VALUES(marker.id,clifford_id)
    ON CONFLICT(headstone_uuid,burial_uuid) DO UPDATE SET
      deleted_at=NULL,deleted_by=NULL,delete_reason=NULL;
  UPDATE headstone_burials SET deleted_at=now(),deleted_by=NULL,
    delete_reason='User confirmed 2026-10-15: TLC-HS-0505 commemorates only Clifford Chester Brant, not Jacoueline Lois Brant.'
    WHERE headstone_uuid=marker.id AND burial_uuid=jacoueline_id AND deleted_at IS NULL;
END $$;

-- Restore association history from the pre-migration backup if needed.
--rollback empty
