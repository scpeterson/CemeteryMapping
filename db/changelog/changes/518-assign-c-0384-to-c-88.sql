--liquibase formatted sql

--changeset cemeterymapping:518-assign-c-0384-to-c-88 splitStatements:false
DO $$
DECLARE
  grave gravesites%ROWTYPE;
  target_lot lots%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM gravesites WHERE gravesite_id='TLC-GPS-0384' AND deleted_at IS NULL) THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(
    (SELECT count(*)=1 FROM gravesites WHERE gravesite_id='TLC-GPS-0384' AND deleted_at IS NULL),
    'Migration 518 requires one active C-0384 gravesite');
  SELECT * INTO grave FROM gravesites WHERE gravesite_id='TLC-GPS-0384' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(
    grave.facility_id='1' AND grave.section_id='C' AND grave.block_uuid IS NULL AND grave.block_id IS NULL
    AND grave.name IN ('Allan J Watenpool','Allan Joseph Watenpool')
    AND (SELECT count(*)=1 FROM lots WHERE cemetery_id=grave.cemetery_id AND facility_id=grave.facility_id
      AND section_id='C' AND lot_id='88' AND block_id IS NULL AND block_uuid IS NULL AND deleted_at IS NULL),
    'Migration 518 requires Allan Watenpool and one active section-scoped C-88 in the same cemetery');
  SELECT * INTO target_lot FROM lots WHERE cemetery_id=grave.cemetery_id AND facility_id=grave.facility_id
    AND section_id='C' AND lot_id='88' AND block_id IS NULL AND block_uuid IS NULL AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(
    target_lot.section_uuid IS NOT DISTINCT FROM grave.section_uuid AND target_lot.burial_use_status='standard'
    AND ((grave.lot_uuid IS NULL AND grave.lot_id IS NULL)
      OR (grave.lot_uuid=target_lot.id AND grave.lot_id='88'))
    AND EXISTS(SELECT 1 FROM headstones h JOIN headstone_gravesites hg ON hg.headstone_uuid=h.id
      WHERE h.headstone_id='TLC-HS-0384' AND h.gravesite_uuid=grave.id AND h.deleted_at IS NULL
        AND h.geometry IS NOT NULL AND hg.gravesite_uuid=grave.id AND hg.deleted_at IS NULL),
    'Migration 518 requires an unassigned or already correctly assigned C-0384 and its active marker; reconcile conflicting assignments first');
  IF grave.lot_uuid=target_lot.id AND grave.lot_id='88' THEN RETURN; END IF;

  -- The reviewed registry relationship is independent of schematic containment.
  -- Do not move/resize polygons, change marker evidence, or create ownership events.
  UPDATE gravesites SET lot_uuid=target_lot.id,lot_id='88',updated_at=now() WHERE id=grave.id;
END $$;

-- Preserve subsequent assignment/ownership edits; use a reviewed forward correction.
--rollback empty
